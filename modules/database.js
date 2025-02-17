// database.js
require('dotenv').config();
const mysql = require('mysql2/promise');

class Database {
  constructor() {
    this.config = {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };
  }

  async connect() {
    try {
      this.pool = mysql.createPool(this.config);
      await this.createTableIfNotExists();
    } catch (err) {
      throw err;
    }
  }

  async createTableIfNotExists() {
    // MySQL syntax to create the table if it does not exist, using InnoDB
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS patient (
        patientid INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100),
        dateOfBirth DATE
      ) ENGINE=InnoDB;
    `;
    try {
      await this.pool.query(createTableQuery);
    } catch (err) {
      throw err;
    }
  }

  /**
   * Executes a query with optional parameters.
   * @param {string} queryString - The SQL query.
   * @param {Array} params - Parameters for the query.
   * @returns {Promise<Array>} - The result rows.
   */
  async query(queryString, params = []) {
    try {
      // Ensure the table exists (this can be removed if you are certain it was created)
      await this.createTableIfNotExists();
      const [rows, fields] = await this.pool.execute(queryString, params);
      return rows;
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Database;
