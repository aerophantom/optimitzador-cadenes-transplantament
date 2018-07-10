var express = require('express');
var app = express();
var path = require('path');
var formidable = require('formidable');
var fs = require('fs');
var Lib = require('./public/js/optimitzador-transplants.js');
var OptimitzadorTransplants;
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
 *      /autoload                   (GET)   → retorna la informació del contingut de memòria en format JSON
 *      /upload                     (POST)  → puja el fitxer per processar i, si és correcte, retorna el resum en format JSON
 *
 *      Per executar codi al servidor:
 *      /cadena-trasplantaments     (POST)  → Crea l'objecte que optimitza la cadena de trasplants.
 *                                  (PUT)   → Obté la cadena de trasplantaments.
 * ================================================================================================================ */

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.get('/autoload', function (req, res) {
    let responseData;

    if (loadedData) {
        console.log("Enviant resum: ",loadedData.filename);
        // S'ha trobat informació a la memòria
        responseData = {
            status: "success",
            summary: {
                origin: loadedData.origin,
                description: loadedData.description ? loadedData.description : 'No s\'ha trobat cap descripció',
                altruists: loadedData.altruists,
                filename: loadedData.filename
            },
            data: loadedData
        };
    } else {
        // No s'ha pujat cap fitxer encara

        responseData = {
            status: "error",
            message: "No s'ha pujat cap fitxer anteriorment"
        };

    }

    res.type('json');
    res.end(JSON.stringify(responseData));
});

app.post('/upload', function (req, res) {
    let form = new formidable.IncomingForm();

    // specify that we want to allow the user to upload multiple files in a single request
    form.multiples = true;

    // store all uploads in the /uploads directory
    form.uploadDir = path.join(__dirname, '/uploads');

    // every time a file has been uploaded successfully,
    // rename it to it's orignal name
    form.on('file', function (field, file) {
        var filepath = path.join(form.uploadDir, file.name);
        fs.rename(file.path, filepath, function () {
            let responseData;

            if (parseDataFile(filepath)) {
                responseData = {
                    status: "success",
                    summary: {
                        origin: loadedData.origin,
                        description: loadedData.description ? loadedData.description : 'No s\'ha trobat cap descripció',
                        altruists: loadedData.altruists,
                        filename: loadedData.filename
                    },
                    data: loadedData
                };
            }
            else {
                // S'ha produït un error
                responseData = {
                    status: "error",
                    message: "No s'ha pogut processar el fitxer correctament"
                };
            }
            res.type('json');
            res.end(JSON.stringify(responseData));
        });
    });

    form.on('error', function (err) {
        console.log('Error:: \n' + err);
    });

    form.parse(req);
});

app.post('/cadena-trasplantaments', function (req, res){
    // en aquesta crida rebem el fitxer JSON
    let form = new formidable.IncomingForm();

    // specify that we want to allow the user to upload multiple files in a single request
    form.multiples = true;

    // store all uploads in the /uploads directory
    form.uploadDir = path.join(__dirname, '/uploads');

    // every time a file has been uploaded successfully,
    // rename it to it's orignal name
    form.on('file', function (field, file) {
        var filepath = path.join(form.uploadDir, file.name);
        fs.rename(file.path, filepath, function () {
            parseDataFile(filepath);
        });
    });

    form.on('error', function (err) {
        console.log('Error:: \n' + err);
    });

    // form.parse(req);
});

app.put('/cadena-trasplantaments', function (req, res){
    // aquesta crida ens demana que calculem la cadena optima
    OptimitzadorTransplants = new Lib.OptimitzadorTransplantsLib(loadedData, true);

    let depth = req.body.profunditat;
    let patient = req.body.pacient;
    let donantsIgnorats = req.body.donantsIgnorats;
    let receptorsIgnorats = req.body.receptorsIgnorats;
    let provesEncreuades = req.body.provesEncreuades;
    let ignorarFallada = req.body.ignorarFallada;

    if (donantsIgnorats.length === 0){
        donantsIgnorats = false;
    }
    if (receptorsIgnorats.length === 0){
        receptorsIgnorats = false;
    }
    if (provesEncreuades.length === 0){
        provesEncreuades = false;
    }

    let result = OptimitzadorTransplants.buildChain(
        depth, patient, donantsIgnorats, receptorsIgnorats, provesEncreuades, ignorarFallada
    );
    let responseData = {
        status: "success",
        message: "chain calculated succesfully",
        trasplantaments: result
    };
    console.log(result);
    res.type('json');
    res.end(JSON.stringify(responseData));
});

var loadedData = null; // Dades carregades a la memòria
/**
 * Analitza el fitxer localitzat a la ruta especificada carregant les dades a memòria i seguidament l'esborra.
 *
 * @param ruta - ruta del fitxer que es vol analitzar
 * @returns {boolean} - cert si s'ha parsejat amb èxit
 */
function parseDataFile(ruta) {
    var esCorrecte = false;

    try {
        loadedData = JSON.parse(fs.readFileSync(ruta, 'utf8'));
        loadedData.filename = path.basename(ruta);
        esCorrecte = true;
    } catch (e) {
        console.error(e);
    }

    fs.unlink(ruta, function () {/* buida per evitar el warning */
    });

    return esCorrecte;
}

/* ================================================================================================================
 *
 * Aquesta secció inicia l'aplicació com a servidor HTTP.
 *
 * ================================================================================================================ */
var port = 80;
var server = app.listen(port, function () {
    console.log('Servidor escoltant al port ' + port);
});
