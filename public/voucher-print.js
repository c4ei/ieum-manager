const params=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.slice(1)),id=params.get('id'),token=params.get('token'),code=hash.get('code');
if(!/^[2-9A-HJ-NP-Z]{10}$/.test(id||'')||!token||!/^[2-9A-HJ-NP-Z]{4}(?:-[2-9A-HJ-NP-Z]{4}){3}$/.test(code||'')){document.body.textContent='올바르지 않은 상품권 인쇄 정보입니다.';}else{
  const front=document.getElementById('front'),status=document.getElementById('front-status'),button=document.getElementById('print');
  document.getElementById('code').textContent=code;
  front.onload=()=>{status.textContent='앞면과 뒷면이 준비되었습니다.';status.className='ready';button.disabled=false;button.textContent='인쇄 또는 PDF 저장';};
  front.onerror=()=>{status.textContent='앞면 이미지를 불러오지 못했습니다. 새로고침 후 다시 시도하세요.';status.className='error';button.textContent='앞면 불러오기 실패';};
  front.src=`/api/vouchers/${id}/image.svg?token=${encodeURIComponent(token)}`;
  button.onclick=()=>window.print();
}
