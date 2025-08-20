// index.js
const cluster = require('cluster');
const os = require('os');

if (cluster.isMaster) {
    const numCPUs = 1;// os.cpus().length; 

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker: any, code: any, signal: any) => {
        console.log(`❎ Worker ${worker.process.pid} died`);
        cluster.fork();
    });
} else {
    // Worker processes will run the server
    require('./server.ts');
}
// docker-compose up -d