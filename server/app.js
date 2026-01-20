const express = require('express');
const app = express();
const PORT = 3000;

const cookieParser = require('cookie-parser');
app.use(cookieParser()); 

const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true, 
}));

const bcrypt = require('bcrypt');

function hashPassword(nakedPass) {
    return bcrypt.hash(nakedPass, 10).then(function(hash) {
      return hash;  
    })
}

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
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
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const poolPromise = new sql.ConnectionPool(config).connect().then(pool => {
    console.log('Connected to MSSQL');
    return pool;
}).catch(err => console.log('Database Connection Failed!', err));


const swaggerAutogen = require('swagger-autogen')()
const outputFile = './swagger_output.json'
const endpointsFiles = ['./app.js']
const doc = {
    info: {
        version: '2',
        title: 'Plant-app-backend',
        description: 'REST API documentation'
    },
    host:'localhost:3000',
}
swaggerAutogen(outputFile, endpointsFiles, doc)

const swaggerUi = require('swagger-ui-express'),
swaggerDocument = require('./swagger_output.json');
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.post('/login', async (req, res) => {
    /*
        #swagger.description = 'User login'
        #swagger.parameters['body'] = {
        in: 'body',
        required: true,
        schema: {
            UserName: "string",
            PasswordHash: "string"
        }
    }
    */
    try {
        const UserName = req.body.UserName;
        const Password = req.body.PasswordHash;

        const pool = await poolPromise;
        const userResult = await pool.request()
            .input('UserName', sql.VarChar, UserName)
            .query('SELECT * FROM Users WHERE UserName = @UserName');

        if (!userResult.recordset.length) {
            return res.status(404).send();
        }

        const user = userResult.recordset[0];

        if (user.AccBlock === 1) {
            return res.status(403).send("account is blocked");
        }

        const isValid = await bcrypt.compare(Password, user.PasswordHash);

        if (!isValid) {
            return res.status(401).json({ success: false, message: "invalid password" });;
        }
        if (isValid) {
            res.cookie('loggedIn', 'true', {
                httpOnly: true,     
                secure: false,
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000
            });

            res.cookie('userID', String(user.Id), {
                httpOnly: false,
                maxAge: 24*60*60*1000,
                path: '/',
                sameSite: 'lax',
                secure: false,
            });

            return res.status(200).json({ success: true });
        }

    res.status(200).json({ success: true });;

    } catch (err) {
        console.error('SQL error:', err);
    }
});

app.post('/register', async (req, res) => {
    /*
        #swagger.description = 'User registration'
        #swagger.parameters['body'] = {
            in: 'body',
            required: true,
            schema: {
                UserName: "string",
                PasswordHash: "string"
            }
        }
    */
    try {
        passHash = await hashPassword(req.body.PasswordHash);
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserName', sql.VarChar, req.body.UserName)
            .input('PasswordHash', sql.VarChar, passHash)
            .query(
                `INSERT INTO Users (Username, PasswordHash, AccLogTry, AccBlock, Role) 
                 VALUES (@UserName, @PasswordHash, 0, 0, 'user')`
            );

        res.status(201).send(result);

    } catch (err) {
        console.error('SQL error:', err);
    }
});

app.get('/plants', async (req, res) => {
    /*
        #swagger.description = 'Fetches plant records linked to user'
        #swagger.parameters['UserId'] = {
            in: 'query',
            required: true,
            type: 'integer'
        }
    */
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserId', sql.Int, req.query.UserId)
            .query('SELECT * FROM Plants WHERE UserId = @UserId');

        res.send(result);

    } catch (err) {
        console.error('SQL error:', err);
    }
});

app.post('/plants', async (req, res) => {
    /*
        #swagger.description = 'creates plant record linked to user'
        #swagger.parameters['body'] = {
            in: 'body',
            required: true,
            schema: {
                UserId: 0,
                NamePlant: "string",
                PresetId: 0,
            }
        }
    */
    try {
        const pool = await poolPromise;
        const plantResult = await pool.request()
            .input('UserId', sql.Int, req.body.UserId)
            .input('NamePlant', sql.VarChar, req.body.NamePlant)
            .input('PresetId', sql.Int, req.body.PresetId)
            .query(
                `INSERT INTO Plants (UserId, NamePlant, PresetId)
                 VALUES (@UserId, @NamePlant, @PresetId)`
            );

        res.status(201).send("Created plant");

    } catch (err) {
        console.error('SQL error:', err);
    }
});

app.put('/plants', async (req, res) => {
    /*
        #swagger.description = 'edits plant record linked to user'
        #swagger.parameters['body'] = {
            in: 'body',
            required: true,
            schema: {
                PlantId: 0,
                UserId: 0,
                NamePlant: "string",
            }
        }
    */
    try {
        const pool = await poolPromise;
        console.log((req.body));

        await pool.request()
            .input('NamePlant', sql.VarChar, req.body.NamePlant)
            .input('UserId', sql.Int, req.body.UserId)
            .input('PlantId', sql.Int, req.body.PlantId)
            .query(
                `UPDATE Plants
                 SET NamePlant = @NamePlant
                 WHERE Id = @PlantId`
            );

        res.status(201).send("Updated plant");

    } catch (err) {
        console.error('SQL error:', err);
    }
});

//The DELETE statement conflicted with the REFERENCE constraint "FK_SensorHistory_Plants". The conflict occurred in database "inzynierka_db", table "dbo.SensorHistory", column 'PlantId'.
app.delete('/plants', async (req, res) => {
    /*
        #swagger.description = 'removes plant record linked to user'
        #swagger.parameters['body'] = {
            in: 'body',
            required: true,
            schema: {
                Id: 0,
            }
        }
    */
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Id', sql.Int, req.body.Id)
            .query(
                `DELETE FROM Plants 
                 WHERE Id = @Id`
            );

        res.status(201).send(result);

    } catch (err) {
        console.error('SQL error:', err);
    }
});

app.get('/preset', async (req, res) => {
  /*
      #swagger.description = 'fetches preset table linked to user'
      #swagger.parameters['Id'] = {
          in: 'query',
          required: true,
          type: 'integer'
      }
  */
  try {
    const presetId = parseInt(req.query.Id);
    if (isNaN(presetId)) {
      return res.status(400).json({ error: "Invalid Id" });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('Id', sql.Int, presetId)
      .query('SELECT * FROM Presets WHERE Id = @Id');

    res.json(result.recordset)
  } catch (err) {
    console.error('SQL error:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post('/preset', async (req, res) => {
    /*
        #swagger.description = 'creates plant record linked to user'
        #swagger.parameters['body'] = {
            in: 'body',
            required: true,
            schema: {
                NamePreset: "string",
                Temp: 0,
                Moist: 0,
                AirQuality: 0,
                UserId: 0,
                IntervalMinutes: 0,
            }
        }
    */
    try {
        const pool = await poolPromise;
        const presetResult = await pool.request()
            .input('NamePreset', sql.VarChar, req.body.NamePreset)
            .input('Temp', sql.Int, req.body.Temp)
            .input('Moist', sql.Int, req.body.Moist)
            .input('AirQuality', sql.Int, req.body.AirQuality)
            .input('UserId', sql.Int, req.body.UserId)
            .input('IntervalMinutes', sql.Int, req.body.IntervalMinutes)
            .query(
                `INSERT INTO Presets (NamePreset, Temp, Moist, AirQuality, UserId, WateringIntervalMinutes)
                OUTPUT INSERTED.Id
                VALUES (@NamePreset, @Temp, @Moist, @AirQuality, @UserId, @IntervalMinutes)`
            );

        const newPresetId = presetResult.recordset[0].Id;
        res.status(201).json({ id: newPresetId });

    } catch (err) {
        console.error('SQL error:', err);
    }
});

app.put('/preset', async (req, res) => {
    /*
        #swagger.description = 'edits preset record linked to user'
        #swagger.parameters['body'] = {
            in: 'body',
            required: true,
            schema: {
                Id: 0,
                NamePreset: "string",
                Temp: 0,
                Moist: 0,
                AirQuality: 0,
                IntervalMinutes: 0
            }
        }
    */
    try {
        const pool = await poolPromise;

        await pool.request()
            .input('NamePreset', sql.VarChar, req.body.NamePreset)
            .input('Temp', sql.Int, req.body.Temp)
            .input('Moist', sql.Int, req.body.Moist)
            .input('AirQuality', sql.Int, req.body.AirQuality)
            .input('Id', sql.Int, req.body.Id)
            .input('IntervalMinutes', sql.Int, req.body.IntervalMinutes)
            .query(
                `UPDATE Presets
                 SET NamePreset = @NamePreset,
                     Temp = @Temp,
                     Moist = @Moist,
                     AirQuality = @AirQuality,
                     WateringIntervalMinutes = @IntervalMinutes
                 WHERE Id = @Id`
            );

        res.status(201).send("Updated preset");

    } catch (err) {
        console.error('SQL error:', err);
    }
});

//The DELETE statement conflicted with the REFERENCE constraint "FK_Plants_Presets". The conflict occurred in database "inzynierka_db", table "dbo.Plants", column 'PresetId'.
app.delete('/preset', async (req, res) => {
    /*
        #swagger.description = 'removes plant record linked to user'
        #swagger.parameters['body'] = {
            in: 'body',
            required: true,
            schema: {
                Id: 0,
            }
        }
    */
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Id', sql.Int, req.body.Id)
            .query(
                `DELETE FROM Presets 
                 WHERE Id = @Id`
            );

        res.status(201).send(result);

    } catch (err) {
        console.error('SQL error:', err);
    }
});

app.get('/history', async (req, res) => {
    /*
        #swagger.description = 'fetches sensor history linked to plant'
        #swagger.parameters['PlantId'] = {
            in: 'query',
            required: true,
            type: 'integer'
        }
    */
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('PlantId', sql.Int, req.query.PlantId)
            .query('SELECT * FROM SensorHistory WHERE PlantId = @PlantId');

        res.send(result);

    } catch (err) {
        console.error('SQL error:', err);
    }
});

app.put('/watering', async (req, res) => {
    /*
        #swagger.description = 'device starts watering the plant when it's value is changed'
    */
   try {
        const pool = await poolPromise;

        await pool.request()
            .input('newValue', true)
            .query(`UPDATE WaterButton SET WaterNow = @newValue`)

        res.json({
            message: 'Watering value updated',
            oldValue: currentValue,
            newValue: !currentValue
        });

   } catch (err){
        console.error('SQL error:', err)
   }
})

app.get('/test', async (req, res) => {
    /*
        #swagger.description = 'test'
        }
    */
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT * FROM Users');

        res.send(result);

    } catch (err) {
        console.error('SQL error:', err);
    }
});

app.use(express.static('client'));
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}/docs`);
});