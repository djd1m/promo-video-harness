// Trusted executable configuration. Original fictional content; no customer inputs.
const dimensions = {'16x9':[1920,1080], '9x16':[1080,1920], '1x1':[1080,1080]};
const mapping = {wide:'16x9', tall:'9x16', square:'1x1'};
function screen(from, caption) {
  const tracks = Object.fromEntries(Object.entries(dimensions).map(([id,size]) => [id,{
    file:`demo-${id}.webm`, size,
    segments:[{from,to:from+11,seconds:11,caption}],
  }]));
  return {type:'screen',seconds:11,footnote:'Synthetic demo data',tracks,
    use:Object.fromEntries(Object.entries(mapping).map(([fmt,track])=>[fmt,{track}]))};
}
export default {
  id:'demo',name:'Little Board',tagline:'Make room for a clear day',url:'Synthetic local demo',
  tokens:{paper:'#f6f5ef',ink:'#172b36',accent:'#165c46'},
  font:{family:'DejaVu Sans',files:[
    {weight:'400',file:'fonts/regular.ttf'}, {weight:'600',file:'fonts/bold.ttf'}, {weight:'700',file:'fonts/bold.ttf'},
  ]},
  capture:{formats:dimensions,seconds:37,fps:25},
  scenes:[
    {type:'title',seconds:6,lines:[{text:'A little board'},{text:'for a clearer day',accent:true}],footnote:'Synthetic demo data'},
    screen(1,'Collect your next steps'),
    screen(12,'Choose what matters today'),
    screen(23,'Celebrate steady progress'),
    {type:'outro',seconds:6,footnote:'Synthetic demo data'},
  ],
};
