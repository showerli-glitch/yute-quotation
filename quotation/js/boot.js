// QUOTATION BOOT (file:// redirect, saved session). Extracted verbatim from index.html at main@655fd20 (quotation split).

(function(){
  // Google OAuth 不接受 file:// 來源；從雲端同步資料夾點開時改用正式網址。
  if(location.protocol === 'file:'){
    location.replace('https://showerli-glitch.github.io/yute-quotation/');
    return;
  }
})();
(function(){
  try{
    var s=localStorage.getItem('yutesign_session');
    if(!s)return;
    var d=JSON.parse(s);
    if(!d.email||!d.email.endsWith('@yutesign.com'))return;
    if(Date.now()-d.loginTime>8*3600*1000)return;
    document.addEventListener('DOMContentLoaded',function(){
      var ls=document.getElementById('loginScreen');
      var ma=document.getElementById('mainApp');
      if(ls)ls.style.display='none';
      if(ma)ma.style.display='';
    });
  }catch(e){}
})();
