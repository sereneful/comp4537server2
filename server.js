const url = require('url');
const http = require('http');
const messages = require('./lang/en/en.js')
const Database = require('./modules/database.js');
const port = process.env.PORT || 4000;
const GET = 'GET';
const POST = 'POST';
const OPTIONS = 'OPTIONS';

/**
 * Handles the HTTP requests with the appropiate logic
 */
class ServerHandler {
  constructor(database) {
    this.database = database;
  }

  // Method to validate SQL queries
  isValidSQLQuery(sqlQuery, allowedStatements) {
    const upperQuery = sqlQuery.trim().toUpperCase();
    const allowed = allowedStatements.some(stmt => upperQuery.startsWith(stmt));
    if (!allowed) {
      return false;
    }
    // Check for disallowed keywords
    const disallowedKeywords = ['UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE'];
    for (const keyword of disallowedKeywords) {
      if (upperQuery.includes(keyword)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Write multiple 'persons' to the database
   * @param {*} req data to insert
   * @param {*} res response sent back to the client 
   */
  handleInsertMultiple(req, res) {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const patients = data.patients;
        if (!Array.isArray(patients)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: messages.invalidFormat }));
          return;
        }
        for (const patient of patients) {
          // Use MySQL parameter syntax with '?' placeholders
          const query = 'INSERT INTO patient (name, dateOfBirth) VALUES (?, ?)';
          const params = [patient.patientName, patient.birthDate];
          await this.database.query(query, params);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: messages.insertSuccess }));
      } catch (err) {
        console.error('Error inserting patients:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: messages.dbError }));
      }
    });
  }
  

  handleQuery(req, res, queryParams) {
    if (req.method === GET) {
      const sqlQuery = queryParams.sql;
      if (!sqlQuery) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: messages.missing }));
        return;
      }
      if (!this.isValidSQLQuery(sqlQuery, ['SELECT'])) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: messages.getQueryError }));
        return;
      }
      this.database.query(sqlQuery).then(result => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      }).catch(err => {
        console.error('Error executing query:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: messages.dbError }));
      });
    } else if (req.method === POST) {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const sqlQuery = data.sql;
          if (!sqlQuery) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: messages.postError }));
            return;
          }
          if (!this.isValidSQLQuery(sqlQuery, ['INSERT'])) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: messages.postQueryError }));
            return;
          }
          await this.database.query(sqlQuery);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: messages.postSuccess }));
        } catch (err) {
          console.error('Error executing query:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: messages.dbError }));
        }
      });
    } else {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: messages.methodError }));
    }
  }
}

/**
 * Initializes the node js server instance
 */
class Server {

  /**
   * Initializes the server with the given port.
   * @param {number} port - The port number for the server.
   */
  constructor(port) {
    this.port = port;
    this.database = new Database();
    this.serverHandler = new ServerHandler(this.database);
    this.server = http.createServer(this.requestHandler.bind(this));
  }

  /**
   * Routes incoming HTTP requests.
   * @param {http.IncomingMessage} req - Request object.
   * @param {http.ServerResponse} res - Response object.
   */
  requestHandler(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    //CORS Handling
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', `${GET}, ${POST}, ${OPTIONS}`);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === OPTIONS) {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === '/') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: messages.welcome }));
      return;
    }

    if (pathname === '/api/insert-multiple' && req.method === POST) {
      console.log("RECEIVING POST REQUEST");
      this.serverHandler.handleInsertMultiple(req, res);
      return;
    }

    if (pathname === '/api/query') {
      this.serverHandler.handleQuery(req, res, parsedUrl.query);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: messages.dbMissing }));
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`Server listening on port ${this.port}`);
    });
  }
}

const myServer = new Server(port);
myServer.database.connect().then(() => {
  myServer.start();
}).catch(err => {
  console.error('Failed to start server:', err);
});