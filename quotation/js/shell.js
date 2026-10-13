// QUOTATION SHELL (undo keys, panel resizer). Extracted verbatim from index.html at main@655fd20 (quotation split).

document.addEventListener('keydown',e=>{
  const tag=document.activeElement.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA')return;
  if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!e.shiftKey){e.preventDefault();undo();}
  else if((e.ctrlKey||e.metaKey)&&((e.key==='z'&&e.shiftKey)||e.key==='y')){e.preventDefault();redo();}
});

// 左右面板拖曳調整寬度
(function(){
  const resizer=document.getElementById('panelResizer');
  const leftPanel=document.querySelector('.panel-left');
  if(!resizer||!leftPanel)return;
  let startX,startW;
  resizer.addEventListener('mousedown',e=>{
    startX=e.clientX;
    startW=leftPanel.offsetWidth;
    resizer.classList.add('dragging');
    document.body.style.cursor='col-resize';
    document.body.style.userSelect='none';
    function onMove(e){
      const w=Math.max(200,Math.min(600,startW+(e.clientX-startX)));
      leftPanel.style.width=w+'px';
    }
    function onUp(){
      resizer.classList.remove('dragging');
      document.body.style.cursor='';
      document.body.style.userSelect='';
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
    }
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
    e.preventDefault();
  });
})();
