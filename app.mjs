"use strict";

var express = require('express');
var app = express();
var path = require('path');
var formidable = require('formidable');
var fs = require('fs');
import TransplantOptimizer from './public/js/TransplantOptimizer';
const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
/* ================================================================================================================
 * La documentació de l'API es pot trobar a: https://app.apiary.io/trasplantaments
 * Aquesta secció correspon a l'encaminament i accepta les següents rutes:
 *      /                           (GET)   → serveix l'index.html
 *      /upload                     (POST)  → puja el fitxer per processar i, si és correcte, retorna el resum en format JSON
 *
 *      Per executar codi al servidor:
 *      /cadena-trasplantaments     (POST)  → Crea l'objecte que optimitza la cadena de trasplants.
 *                                  (PUT)   → Obté la cadena de trasplantaments.
 * ================================================================================================================ */

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.post('/cadena-trasplantaments', function (req, res){
    // en aquesta crida rebem els fitxers JSON
    let form = new formidable.IncomingForm();

    // specify that we want to allow the user to upload multiple files in a single request
    form.multiples = true;

    // store all uploads in the /uploads directory
    form.uploadDir = path.join(__dirname, '/uploads');

    form.on('error', function (err) {
        console.log('Error:: \n' + err);
    });

    form.parse(req, function(err, fields, files){
        let response = {};
        if (Array.isArray(files["uploads[]"])){
            // Si es una llista llavors ha penjat multiples fitxers
            for(const f of files["uploads[]"]){
                let hash = parseDataFile(f.path);
                response[hash.toString()] = f.name;
            }
        }
        else{
            // nomes ha penjat un fitxer
            let hash = parseDataFile(files["uploads[]"].path);
            response[hash.toString()] = files["uploads[]"].name;
        }
        res.type('json');
        res.end(JSON.stringify(response));
    });
});

app.put('/cadena-trasplantaments', function (req, res){
    // aquesta crida ens demana que calculem la cadena optima
    let id = req.body.id;
    let depth = req.body.profunditat;
    let patient = req.body.pacient;

    let kwargs = {
        ignoredDonors: req.body.donantsIgnorats,
        ignoredRecipients: req.body.receptorsIgnorats,
        crossedTests: req.body.provesEncreuades,
        ignoreFailureProbability: req.body.ignorarFallada
    };

    let result = objects[id].buildChain(depth, patient, kwargs);
    let responseData = {
        status: "success",
        message: "chain calculated succesfully",
        trasplantaments: result
    };
    res.type('json');
    res.end(JSON.stringify(responseData));
});

app.get('/resum', function (req, res){
    let id = req.query.id;
    let responseData = objects[id].summary;
    res.type('json');
    res.end(JSON.stringify(responseData));
});

app.get('/fitxer', function (req, res){
    let id = req.query.id;
    let responseData = objects[id].update;
    res.type('json');
    res.end(JSON.stringify(responseData));
});

/**
 *
 * @type {{string: TransplantOptimizer}}
 */
var objects = {}; // Dades carregades a la memòria
/**
 * Analitza el fitxer localitzat a la ruta especificada carregant les dades a memòria i seguidament l'esborra.
 *
 * @param ruta - ruta del fitxer que es vol analitzar
 * @returns {boolean} - cert si s'ha parsejat amb èxit
 */
function parseDataFile(ruta) {
    let id = undefined;
    try {
        let data = JSON.parse(fs.readFileSync(ruta, 'utf8'));
        let object = new TransplantOptimizer(data);
        id = object.hashCode;
        objects[id] = object;
    } catch (e) {
        console.error(e);
    }

    fs.unlink(ruta, function () {/* buida per evitar el warning */
    });

    return id;
}

/* ================================================================================================================
 *
 * Aquesta secció inicia l'aplicació com a servidor HTTP.
 *
 * ================================================================================================================ */
var port = 8069;
var server = app.listen(port, function () {
    console.log('Servidor escoltant al port ' + port);
});
