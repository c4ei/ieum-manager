const setText=(id,value)=>{const element=document.getElementById(id);if(element)element.textContent=value;};
async function loadVersions(){
  try{
    const response=await fetch('/api/snapshot');
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    const manager=`IEUM Manager v${data.managerVersion}`;
    const chain=data.chainVersion?`IEUM Chain v${data.chainVersion}`:data.chainVersions?.length?`Chain 버전 불일치: ${data.chainVersions.join(' / ')}`:'IEUM Chain 확인 불가';
    setText('manager-version',manager);setText('footer-manager-version',manager);
    setText('chain-version',chain);setText('footer-chain-version',chain);
  }catch{
    setText('manager-version','Manager 연결 확인 필요');setText('chain-version','Chain 연결 확인 필요');
  }
}
loadVersions();
