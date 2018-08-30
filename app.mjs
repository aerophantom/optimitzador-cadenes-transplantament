"use strict";

import express from 'express';
import path from 'path';
import formidable from 'formidable';
import fs from 'fs';
import TransplantOptimizer from './public/js/TransplantOptimizer';
import bodyParser from 'body-parser';
import Utils from "./public/js/Utils";

/* =============================================================================
 *
 * app initialization
 *
 * ========================================================================== */

let __dirname = path.dirname(new URL(import.meta.url).pathname);
// if path has whitespeaces, then path.dirname will replace them with "%20"
// the next function replaces the "%20" with whitespaces
__dirname = __dirname.replace(/%20/g, " ");
+__dirname = __dirname.replace("/", "");
/**
 * For each file loaded, there will be a TrasplantOptimizer object.
 * @type {{string: TransplantOptimizer}}
 */
let objects = {};
let app = express();

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

/* =============================================================================
 *
 * REST treatment
 * API Documentation:
 *     https://trasplantaments.docs.apiary.io/#
 *
 * ========================================================================== */

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.post('/cadena-trasplantaments', function (req, res){
    // en aquesta crida rebem els fitxers JSON
    let form = new formidable.IncomingForm();

    // specify that we want to allow the user to upload multiple files in a
    // single request
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

app.patch('/cadena-trasplantaments', function (req, res){
    // aquesta crida ens demana que calculem la cadena optima
    let id = req.body.id;
    let depth = req.body.profunditat;
    let patient = req.body.pacient;

    let kwargs = {
        ignoredDonors: req.body.donantsIgnorats,
        ignoredRecipients: req.body.receptorsIgnorats,
        crossedTests: req.body.provesEncreuades,
        ignoreFailureProbability: req.body.ignorarFallada,
        chainLength: req.body.longitudCadena
    };

    let result = objects[id].buildChain(depth, patient, kwargs);

    res.type('json');
    res.end(JSON.stringify(result));
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

app.get('/log', function (req, res){
    let id = req.query.id;
    let responseData = objects[id].log;
    res.type('text');
    res.end(JSON.stringify(responseData));
});

/* =============================================================================
 *
 * Helper functions
 *
 * ========================================================================== */

/**
 * Analitza el fitxer localitzat a la ruta especificada carregant les dades a
 * memòria i seguidament l'esborra.
 *
 * @param {string} ruta - ruta del fitxer que es vol analitzar
 * @returns {boolean} - cert si s'ha parsejat amb èxit
 */
function parseDataFile(ruta) {
    let id;
    try {
        let compatibilityGraph = JSON.parse(fs.readFileSync(ruta, 'utf8'));
        Utils.toAppFormat(compatibilityGraph);
        let object = new TransplantOptimizer(compatibilityGraph);
        id = object.hashCode;
        objects[id] = object;
    } catch (e) {
        console.error(e);
    }

    fs.unlink(ruta, function () {/* buida per evitar el warning */
    });

    return id;
}

/* =============================================================================
 *
 * Start HTTP server
 *
 * ========================================================================== */
let port = 8069;
app.listen(port, function () {
    console.log('Servidor escoltant al port ' + port);
});
