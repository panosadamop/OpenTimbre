/** Physical-model-inspired plucked strings, NOT a trained generative AI model. */
export type PluckInstrument='oud'|'saz';
export function synthesizePluck(midi:number,kind:PluckInstrument,duration=2.5,sampleRate=44100):Float32Array{
 const n=Math.ceil(duration*sampleRate),out=new Float32Array(n),f=440*Math.pow(2,(midi-69)/12);
 const harmonics=kind==='oud'? [1,.52,.31,.17,.1,.065,.04]:[1,.72,.46,.3,.19,.12,.07,.045];
 const decay=kind==='oud'?2.5:1.8;
 for(let i=0;i<n;i++){const t=i/sampleRate;let v=0;
  for(let h=0;h<harmonics.length;h++){const k=h+1;v+=harmonics[h]*Math.sin(2*Math.PI*f*k*t+(k*k*.003))*Math.exp(-t*(decay+.16*h));}
  const attack=Math.min(1,t*240);const release=Math.min(1,(duration-t)*24);
  out[i]=Math.max(-1,Math.min(1,v*.25*attack*Math.max(0,release)));
 }return out;
}
export function encodeMonoWav(samples:Float32Array,rate=44100):ArrayBuffer{
 const b=new ArrayBuffer(44+samples.length*2),v=new DataView(b);const str=(i:number,t:string)=>{for(let j=0;j<t.length;j++)v.setUint8(i+j,t.charCodeAt(j))};
 str(0,'RIFF');v.setUint32(4,36+samples.length*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,samples.length*2,true);
 for(let i=0;i<samples.length;i++){const x=Math.max(-1,Math.min(1,samples[i]));v.setInt16(44+i*2,x<0?x*32768:x*32767,true)}return b;
}
