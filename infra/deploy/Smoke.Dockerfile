FROM node:22-bookworm-slim
USER node
EXPOSE 8080
CMD ["node", "-e", "require('node:http').createServer((req,res)=>{res.writeHead(200,{'content-type':'text/plain'});res.end(process.env.RELEASE+'\\n')}).listen(8080,'0.0.0.0')"]
