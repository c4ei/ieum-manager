const quantity=value=>{
  if(typeof value==='bigint')return value;
  if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)return BigInt(value);
  if(typeof value==='string'&&(/^0x[0-9a-f]+$/i.test(value)||/^\d+$/.test(value)))return BigInt(value);
  throw new Error('올바르지 않은 거래 수수료 수량입니다.');
};

export function actualTransactionFee(transaction,receipt){
  const gasUsed=quantity(receipt?.gasUsed);
  const gasPrice=quantity(receipt?.effectiveGasPrice??transaction?.gasPrice);
  return gasUsed*gasPrice;
}
