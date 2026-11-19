export type WeatherDay = {date:string;weather_code:number|null;temperature_min_c:number|null;temperature_max_c:number|null;precipitation_mm:number|null;precipitation_probability_percent:number|null};
export type WeatherView = {status:"date_needed"|"outside_forecast_window"|"forecast"|"not_covered";visit_date:string|null;timezone:string;horizon_start:string;horizon_end:string;coverage_start:string|null;coverage_end:string|null;day:WeatherDay|null;retrieved_at:string|null;cached:boolean;source:"Open-Meteo"};
const iso=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+"T12:00:00Z"))&&new Date(v+"T12:00:00Z").toISOString().slice(0,10)===v;
export function isWeatherView(value:unknown,requestedDate:string|null):value is WeatherView {
  if(!value||typeof value!=="object")return false;
  const v=value as WeatherView;
  if(!["date_needed","outside_forecast_window","forecast","not_covered"].includes(v.status)||v.visit_date!==requestedDate||v.source!=="Open-Meteo"||typeof v.timezone!=="string"||typeof v.cached!=="boolean"||!iso(v.horizon_start)||!iso(v.horizon_end)||v.horizon_end<v.horizon_start)return false;
  if(v.status!=="forecast")return v.day===null&&(v.status==="date_needed"?requestedDate===null:requestedDate!==null);
  const d=v.day;
  if(!d||d.date!==requestedDate||!iso(d.date)||!iso(v.coverage_start)||!iso(v.coverage_end)||d.date<v.coverage_start!||d.date>v.coverage_end!||typeof v.retrieved_at!=="string"||!Number.isFinite(Date.parse(v.retrieved_at)))return false;
  const numeric=(n:unknown,min:number,max:number)=>n===null||typeof n==="number"&&Number.isFinite(n)&&n>=min&&n<=max;
  return numeric(d.weather_code,0,99)&&(d.weather_code===null||Number.isInteger(d.weather_code))&&numeric(d.temperature_min_c,-100,70)&&numeric(d.temperature_max_c,-100,70)&&numeric(d.precipitation_mm,0,2000)&&numeric(d.precipitation_probability_percent,0,100)&&(d.temperature_min_c===null||d.temperature_max_c===null||d.temperature_min_c<=d.temperature_max_c)&&[d.weather_code,d.temperature_min_c,d.temperature_max_c,d.precipitation_mm,d.precipitation_probability_percent].some(n=>n!==null);
}
export const weatherAdapter={async check(reference:string,date:string,signal:AbortSignal):Promise<WeatherView>{
  const base=process.env.NEXT_PUBLIC_API_BASE_URL;if(!base)throw new Error("Weather checks are not configured. Your trip is unchanged.");
  let response:Response;
  try{response=await fetch(`${base.replace(/\/$/,"")}/weather?destination_reference_id=${encodeURIComponent(reference)}${date?`&visit_date=${encodeURIComponent(date)}`:""}`,{signal:AbortSignal.any([signal,AbortSignal.timeout(12000)]),cache:"no-store",credentials:"omit"});}
  catch(failure){if(signal.aborted)throw failure;throw new Error("Weather could not respond in time. Your trip is unchanged; try again later.");}
  if(!response.ok)throw new Error(response.status===429?"Weather checks are busy. Wait a minute before trying again.":"Weather is unavailable right now. Your trip is unchanged.");
  const value=(await response.json()).data;
  if(!isWeatherView(value,date||null))throw new Error("Weather returned incomplete or unexpected data. No forecast is assumed.");
  return value;
}};
export function weatherCondition(code:number|null){
  if(code===0)return "Clear sky";if(code===1)return "Mainly clear";if(code===2)return "Partly cloudy";if(code===3)return "Overcast";
  if(code===45||code===48)return "Fog";if([51,53,55].includes(code??-1))return "Drizzle";if(code===56||code===57)return "Freezing drizzle";
  if([61,63,65].includes(code??-1))return "Rain";if(code===66||code===67)return "Freezing rain";if([71,73,75,77].includes(code??-1))return "Snow";
  if([80,81,82].includes(code??-1))return "Rain showers";if(code===85||code===86)return "Snow showers";if([95,96,99].includes(code??-1))return "Thunderstorms";
  return "Condition not reported";
}
