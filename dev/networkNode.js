const express = require("express");
const app = express();
const rp=require('request-promise')


const bodyParser = require("body-parser")
const Blockchain = require("./blockchain")
const { v4: uuidv4 } = require('uuid');

const nodeAddress=uuidv4().split('-').join("")
const port=process.argv[2]
console.log(nodeAddress)

const bitcoin = new Blockchain();

// process
//   .on('unhandledRejection', (reason, p) => {
//     console.error(reason, 'Unhandled Rejection at Promise', p);
//   })
//   .on('uncaughtException', err => {
//     console.error(err, 'Uncaught Exception thrown');
//   //  process.exit(1);
//   });
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


app.get('/blockchain', function (req, res) {
    res.send(bitcoin)
});

app.post('/transaction', function (req, res) {
    let newTransaction = req.body
    const blockIndex = bitcoin.addTransactiontoPendingTransactions(newTransaction)
    res.json({ note: `Transaction will be added in block ${blockIndex}` })
});

app.post('/transaction/broadcast', function (req, res) {

    let { amount, sender, recipient } = req.body
    const newTransaction = bitcoin.createNewTransaction(amount, sender, recipient)
    bitcoin.addTransactiontoPendingTransactions(newTransaction)
    const regNodesPromises=[]
    bitcoin.networkNodes.forEach(networkNodeUrl=>{
  
            const requestOptions={
                uri:`${networkNodeUrl}/transaction`,
                method:'POST',
                body:newTransaction,
                json:true
            }
    
            regNodesPromises.push(rp(requestOptions))
    
        })

        Promise.all(regNodesPromises)
        .then(data=>{

            res.json({note:"Transaction created and broadcasted successfully"})
        })

})

app.get('/mine', function (req, res) {
    //console.log("response")
    const lastBlock=bitcoin.getLastBlock();
    const previousBlockHash=lastBlock.hash
    const currentBlockData={
        transactions:bitcoin.pendingTransactions,
        index:lastBlock['index']+1
    }
 //   console.log(previousBlockHash,currentBlockData,'demon')
    var startTime=console.time();
    const nonce=bitcoin.proofOfWork(previousBlockHash,currentBlockData);
    var endtime=console.timeEnd();
   // console.log(nonce,"demon41")
    const blockHash=bitcoin.hashBlock(previousBlockHash,currentBlockData,nonce)
   
    const newBlock=bitcoin.createNewBlock(nonce,previousBlockHash,blockHash);

    const regNodesPromises=[]
    bitcoin.networkNodes.forEach(networkNodeUrl=>{
  
            const requestOptions={
                uri:`${networkNodeUrl}/recieve-new-block`,
                method:'POST',
                body:{newBlock},
                json:true
            }
    
            regNodesPromises.push(rp(requestOptions))
    
        })

        Promise.all(regNodesPromises)
        .then(data=>{

            //bitcoin.createNewTransaction(12.5,"00",nodeAddress);
            const requestOptions={
                uri:`${currentNodeUrl}/recieve-new-block`,
                method:'POST',
                body:{amount:12.5,sender:"00",recipient:nodeAddress},
                json:true
            }

           return rp(requestOptions)
        })
        .then(data=>{
            let response={note:"New Block mined",block:newBlock,startTime:startTime,endtime:endtime}
            res.json(response)
        })

});
app.post('/receive-new-block',function(req,res){
const newBlock=req.body.newBlock;
const lastBlock=bitcoin.getLastBlock();
const correctHash=lastBlock.hash === newBlock.previousBlockHash
const correctIndex=lastBlock['index']+1 === newBlock['index']
if(correctHash && correctIndex){
    bitcoin.chain.push(newBlock);
    bitcoin.pendingTransactions=[];
    res.json({note:"New Block recieved and accepted",newBlock:newBlock})
}else{
    res.json({note:"New Block rejected",newBlock:newBlock})
}
})

app.post('/register-and-broadcast-node',function(req,res){
    const newNodeUrl=req.body.newNodeUrl
    if(bitcoin.networkNodes.indexOf(newNodeUrl== -1 ))bitcoin.networkNodes.push(newNodeUrl)
    const regNodesPromises=[]
    bitcoin.networkNodes.forEach(networkNodeUrl=>{
  
        const requestOptions={
            uri:`${networkNodeUrl}/register-node`,
            method:'POST',
            body:{newNodeUrl:newNodeUrl},
            json:true
        }

        regNodesPromises.push(rp(requestOptions))

    })

    Promise.all(regNodesPromises)
    .then(data=>{
        const bulkRegisterOptions={
            uri:`${newNodeUrl}/register-nodes-bulk`,
            method:'POST',
            body:{allNetworkNodes:[...bitcoin.networkNodes,bitcoin.currentNodeUrl]},
            json:true
        }
        return rp(bulkRegisterOptions)
    })
    .then(data=>{

      res.json({note:"New node is registered in network successfully"})

    })
})

app.post('/register-node',function(req,res){
    const newNodeUrl=req.body.newNodeUrl
    const nodeNoteAlreadyPresent=bitcoin.networkNodes.indexOf(newNodeUrl)== -1
    const notCurrentNode=bitcoin.currentNodeUrl !== newNodeUrl

    if(nodeNoteAlreadyPresent && notCurrentNode) bitcoin.networkNodes.push(newNodeUrl)
    res.json({note:"New node registered successfully"})
})
app.post('/register-nodes-bulk',function(req,res){
const allNetworkNodes=req.body.allNetworkNodes 
      
    allNetworkNodes.forEach(networkNodeUrl=>{
        const nodeNoteAlreadyPresent=bitcoin.networkNodes.indexOf(networkNodeUrl)== -1
        const notCurrentNode=bitcoin.currentNodeUrl !== networkNodeUrl
    if(nodeNoteAlreadyPresent && notCurrentNode )bitcoin.networkNodes.push(networkNodeUrl)
    })

    res.json({note:"Bulk registration successfull"})

})



// consensus
app.get('/consensus', function(req, res) {
	const requestPromises = [];
	bitcoin.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/blockchain',
			method: 'GET',
			json: true
		};

		requestPromises.push(rp(requestOptions));
	});

	Promise.all(requestPromises)
	.then(blockchains => {
		const currentChainLength = bitcoin.chain.length;
		let maxChainLength = currentChainLength;
		let newLongestChain = null;
		let newPendingTransactions = null;

		blockchains.forEach(blockchain => {
			if (blockchain.chain.length > maxChainLength) {
				maxChainLength = blockchain.chain.length;
				newLongestChain = blockchain.chain;
				newPendingTransactions = blockchain.pendingTransactions;
			};
		});


		if (!newLongestChain || (newLongestChain && !bitcoin.chainIsValid(newLongestChain))) {
			res.json({
				note: 'Current chain has not been replaced.',
				chain: bitcoin.chain
			});
		}
		else {
			bitcoin.chain = newLongestChain;
			bitcoin.pendingTransactions = newPendingTransactions;
			res.json({
				note: 'This chain has been replaced.',
				chain: bitcoin.chain
			});
		}
	});
});


// get block by blockHash
app.get('/block/:blockHash', function(req, res) { 
	const blockHash = req.params.blockHash;
	const correctBlock = bitcoin.getBlock(blockHash);
	res.json({
		block: correctBlock
	});
});


// get transaction by transactionId
app.get('/transaction/:transactionId', function(req, res) {
	const transactionId = req.params.transactionId;
	const trasactionData = bitcoin.getTransaction(transactionId);
	res.json({
		transaction: trasactionData.transaction,
		block: trasactionData.block
	});
});


// get address by address
app.get('/address/:address', function(req, res) {
	const address = req.params.address;
	const addressData = bitcoin.getAddressData(address);
	res.json({
		addressData: addressData
	});
});


// block explorer
app.get('/block-explorer', function(req, res) {
	res.sendFile('./block-explorer/index.html', { root: __dirname });
});


app.listen(port, function () {
    console.log(`listening on port ${port}`)
});


//occur spoil biology chuckle donor shine taxi web royal stick scorpion desert
//14f03803876b1a1144efb08a56838175926cd93c18eb40a1892444622616a65f   -- private key