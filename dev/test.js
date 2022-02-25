const Blockchain=require('./blockchain');

const bitcoin= new Blockchain();

bitcoin.createNewBlock(123,'OIWJWUWS900BJ','USBDIWHUW97765JJJ')
bitcoin.createNewTransaction(200,"txn1","txn2")
bitcoin.createNewBlock(242,'OIWJWUWS900BJ234','USBDIWHUW97765JJJ56')




console.log(bitcoin,'bitcoin')