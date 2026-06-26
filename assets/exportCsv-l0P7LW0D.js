function r(e){const t=String(e??"");return/[";\n]/.test(t)?`"${t.replace(/"/g,'""')}"`:t}function u(e,t,c){const a=c.map(n=>r(n.label)).join(";"),d=t.map(n=>c.map(p=>r(p.value(n))).join(";")).join(`
`),l=`${a}
${d}`,i=new Blob(["\uFEFF"+l],{type:"text/csv;charset=utf-8;"}),s=URL.createObjectURL(i),o=document.createElement("a");o.href=s,o.download=e.endsWith(".csv")?e:`${e}.csv`,document.body.appendChild(o),o.click(),document.body.removeChild(o),URL.revokeObjectURL(s)}export{u as e};
