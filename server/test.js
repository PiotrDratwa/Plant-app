const sql = require('mssql');

const config = {
  user: 'adminuser',
  password: 'Haslo123!',
  server: 'inzynierka-server.database.windows.net',
  database: 'inzynierka_db',
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

async function run() {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT Message FROM Test where id = 1');
    console.log(result.recordset);
    await pool.close();
  } catch (err) {
    console.error('SQL error:', err);
  }
}

run();