export function createStemPlayer(options:{stems:{id:string;label:string;url:string}[];duration?:number;headroom?:number;volume?:number;onChange?:(state:AudioState)=>void}):{
 state:AudioState;play:()=>Promise<boolean>;pause:(reason?:string)=>boolean;seek:(seconds:number)=>Promise<boolean>;setVolume:(value:number)=>boolean;setMuted:(value:boolean)=>boolean;setLoop:(value:boolean)=>boolean;dispose:()=>void;getDiagnostics:()=>{contextState:string;rms:number;envelopeGain:number;media:{id:string;paused:boolean;readyState:number;time:number}[]};
};
export type AudioState={status:string;volume:number;muted:boolean;activated:boolean;error:string|null;currentTime:number;duration:number};
