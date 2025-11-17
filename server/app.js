const express = require('express');
const app = express();
const PORT = 3000;

const cors = require('cors');
app.use(cors({origin: '*'}));

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());


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


const swaggerAutogen = require('swagger-autogen')()
const outputFile = './swagger_output.json'
const endpointsFiles = ['./app.js']
const doc = {
    info: {
    version: '2',
    title: 'Plant-app-backend',
    description: 'REST API documentation'
    },
    host: 'localhost:3000',
    }
swaggerAutogen(outputFile, endpointsFiles, doc)

const swaggerUi = require('swagger-ui-express'),
swaggerDocument = require('./swagger_output.json');
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get(('/login'), async (req, res) =>{
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`SELECT * FROM Users where UserName like ${req.UserName} and PasswordHash like ${req.PasswordHash}`);
        console.log(result.recordset);
        await pool.close();
    } catch (err) {
        console.error('SQL error:', err);
    }
    console.log(result)
    if (result == ""){
        res.status(404).send()
    } else if(result.AccBlock === 1){
        res.status(403).send("account is blocked")
    } else {
        res.status(200).send()
    }
})

app.post(('/register'), async (req, res) =>{
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(
            `INSERT INTO Users (Username, PasswordHash, AccLogTry, AccBlock, Role) 
            VALUES (${req.UserName}, ${req.PasswordHash}, 0, 0, 'user')`);
        console.log(result.recordset);
        await pool.close();
    } catch (err) {
        console.error('SQL error:', err);
    }
    res.status(201).send(result);
})

app.get(('/plants'), async (req, res) =>{
    // #swagger.description = 'fetches plant table linked to user'
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`SELECT * FROM Plants where UserId like ${req.UserId}`);
        console.log(result.recordset);
        await pool.close();
    } catch (err) {
        console.error('SQL error:', err);
    }
    console.log(result)
    res.send(result)
})

app.post(('/plants'), async (req, res) =>{
    // #swagger.description = 'creates plant and preset table linked to user'
    try {
        const pool = await sql.connect(config);

        const presetResult = await pool.request().query(
            `INSERT INTO Presets (NamePreset, Temp, Moist, AirQuality)
             OUTPUT INSERTED.Id
             VALUES ('${req.NamePreset}', ${req.Temp}, ${req.Moist}, ${req.AirQuality})`
        );

        const presetId = presetResult.recordset[0].Id;

        const plantResult = await pool.request().query(
            `INSERT INTO Plants (UserId, NamePlant, PresetId)
             VALUES (${req.UserId}, '${req.NamePlant}', ${presetId})`
        );

        console.log(plantResult.recordset);
        await pool.close();
    } catch (err) {
        console.error('SQL error:', err);
    }
    res.status(201).send("Created plant and preset");
});

app.put(('/plants'), async (req, res) =>{
    // #swagger.description = 'edits plant and preset table linked to user'
    try {
        const pool = await sql.connect(config);

        const plantResult = await pool.request().query(
            `UPDATE Plants
             SET NamePlant = '${req.NamePlant}',
                 UserId = ${req.UserId},
                 PresetId = ${req.PresetId}
             WHERE Id = ${req.PlantId}`
        );

        const presetResult = await pool.request().query(
            `UPDATE Presets
             SET NamePreset = '${req.NamePreset}',
                 Temp = ${req.Temp},
                 Moist = ${req.Moist},
                 AirQuality = ${req.AirQuality}
             WHERE Id = ${req.PresetId}`
        );

        console.log(plantResult.recordset, presetResult.recordset);
        await pool.close();
    } catch (err) {
        console.error('SQL error:', err);
    }
    res.status(201).send("Updated plant and preset");
});

app.delete(('/plants'), async (req, res) =>{     
    // #swagger.description = 'removes plant and preset table linked to user'
    try {
        const pool = await sql.connect(config);

        const presetid = await pool.request().query(
            `select PresetId from table WHERE NamePlant like '${req.NamePlant}' and UserId like '${req.UserId}'`
        );

        const result = await pool.request().query(
            `DELETE from table WHERE NamePlant like '${req.NamePlant}' and UserId like '${req.UserId}'`
        );

        if (presetid.recordset.length > 0) {
            await pool.request().query(
                `DELETE FROM Presets WHERE Id = ${presetid.recordset[0].PresetId}`
            );
        }

        console.log(result.recordset);
        await pool.close();
    } catch (err) {
        console.error('SQL error:', err);
    }
    res.status(201).send(result);
})

app.get(('/preset'), async (req, res) =>{
    // #swagger.description = 'fetches preset table linked to user'
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`SELECT * FROM presets where UserId like ${req.UserId}`);
        console.log(result.recordset);
        await pool.close();
    } catch (err) {
        console.error('SQL error:', err);
    }
})

app.get(('/history'), async (req, res) =>{
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`SELECT * FROM SensorHistory where PlantId like ${req.PlantId}`);
        console.log(result.recordset);
        await pool.close();
    } catch (err) {
        console.error('SQL error:', err);
    }
})

app.use(express.static('client'));
app.listen(PORT, () => {
console.log(`Server running on http://localhost:${PORT}`);
});