export function riverCenter(z:number):number;
export function riverWidth(z:number):number;
export function terrainHeight(x:number,z:number):number;
export interface MountainProfile {name:string;x:number;z:number;width:number;depth:number;tall:number;phase:number;profile:number[]}
export const mountainProfiles:MountainProfile[];
export function ridgeHeight(u:number,v:number,spec:MountainProfile):number;

export function passOneHeight(x:number,z:number):number;
export function ridgeBands(u:number,spec:MountainProfile):number[];

export function shelfCoverage(u:number,level:number,spec:MountainProfile):number;
