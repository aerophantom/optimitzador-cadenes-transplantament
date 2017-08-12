var express = require('express');
var app = express();
var path = require('path');
var formidable = require('formidable');
var fs = require('fs');

app.use(express.static(path.join(__dirname, 'public')));

/* ================================================================================================================
 *
 * Aquesta secció correspon a l'encaminament i accepta les següents rutes:
 *      / (GET)                 - serveix l'index.html
 *      /autoload (GET)         - retorna la informació del contingut de memoria en format JSON
 *      /upload (POST)          - puja el fitxer per processar i, si és correcte, retorna el resum en format JSON
 *
 * ================================================================================================================ */
app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'views/index.html'));
});


app.get('/autoload', function (req, res) {
    var responseData;


    if (loadedData) {
        // S'ha trobat informació a la memòria
        responseData = {
            status: "success",
            summary: {
                origin: loadedData.origin,
                description: loadedData.description ? loadedData.description : 'No s\'ha trobat cap descripció',
                altruists: loadedData.altruists,
                dadesTimestamp: dadesTimeStamp
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
    var form = new formidable.IncomingForm();

    // specify that we want to allow the user to upload multiple files in a single request
    form.multiples = true;

    // store all uploads in the /uploads directory
    form.uploadDir = path.join(__dirname, '/uploads');

    // every time a file has been uploaded successfully,
    // rename it to it's orignal name
    form.on('file', function (field, file) {
        var filepath = path.join(form.uploadDir, file.name);
        fs.rename(file.path, filepath, function () {

            var responseData;

            if (parseDataFile(filepath)) {
                responseData = {
                    status: "success",
                    summary: {
                        origin: loadedData.origin,
                        description: loadedData.description ? loadedData.description : 'No s\'ha trobat cap descripció',
                        altruists: loadedData.altruists,
                        dadesTimestamp: dadesTimeStamp
                    },
                    data: loadedData
                };
            } else {
                // S'ha produit un error
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
var port = 3000;
var server = app.listen(port, function () {
    console.log('Servidor escoltant al port ' + port);
});