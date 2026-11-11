import type {Instrument} from '../../core/src/index';
export function generateSFZ(instrument:Instrument){return '// OpenTimbre generated SFZ — subset mapping\n'+instrument.samples.map(s=>`<region> sample=${s.path.replaceAll(' ','_')} key=${s.root} lokey=${s.lo} hikey=${s.hi} lovel=${s.velocityMin} hivel=${s.velocityMax} tune=${s.rootCents} group=${s.roundRobin+1}`).join('\n')+'\n'}
