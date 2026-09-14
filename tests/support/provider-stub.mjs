const original=globalThis.fetch;const orders=new Map();
globalThis.fetch=async(input,init)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  if(!url.startsWith('https://api.razorpay.com/v1/'))return original(input,init);
  const path=new URL(url).pathname;
  if(path==='/v1/orders'&&init?.method==='POST'){
    const body=JSON.parse(init.body);const id='order_isolated_'+crypto.randomUUID().replaceAll('-','');orders.set(id,{id,amount:body.amount,currency:'INR'});
    return Response.json(orders.get(id));
  }
  const match=path.match(/^\/v1\/payments\/(pay_isolated_.+)$/);
  if(match){const orderId=match[1].replace('pay_isolated_','order_isolated_');const order=orders.get(orderId);return Response.json({id:match[1],order_id:orderId,amount:order?.amount??50000,currency:'INR',status:'captured'});}
  if(path.endsWith('/payments'))return Response.json({items:[]});
  return Response.json({error:'Unsupported isolated provider request'},{status:404});
};
