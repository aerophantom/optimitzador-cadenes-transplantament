$(document).ready(function () {

    /**
     * Llista d'objectes que conté la informació que constitueix una cadena.
     * @typedef {Array.<{receptor: string, donant: string, probExit: number, valor: number}>} Chain
     * @
     */

    const filename = "UpdatedObject.json";
    let ignoraDonants = [],
        ignoraReceptors = [],
        resultatsProvaEncreuada = [],
        confirmats = [],
        previousDepth,
        previousDonor,
        chainsDataTable,
        originalAltruists = [],
        currentAltruists = [],
        serverSide = false,
        descendent = true,
        selectedHash = false,
        fileName = {},
        objects = {};

    /**
     * Inicialitza els detectors d'esdeveniments de l'interfície
     */
    function inicialitzarListeners() {
        let $upload_input = $('.upload-input');
        let $progress_bar = $('.progress-bar');
        let $download = $('#dwn-btn');

        $download.on('click', function () {

            if(serverSide){
                let params = {"id": selectedHash};
                $.ajax({
                    url: '/fitxer',
                    type: 'GET',
                    data: params,
                    dataType: 'json',
                    contentType: false,
                    success: downloadUpdatedFile
                });
            }
            else{
                downloadUpdatedFile(objects[selectedHash].update());
                //TODO: Agregar boton para descargar el log.
                // download("log.txt", objects[selectedHash].getLog());
            }
        });

        $('.upload-btn').on('click', function () {
            $upload_input.val(null);
            $upload_input.click();
            $('.progress').toggle(true);
            $progress_bar.text('0%');
            $progress_bar.width('0%');
        });

        $upload_input.on('change', function () {
            let files = $(this).get(0).files;

            if (files.length > 0) {
                serverSide = $('#server-side').is(":checked");
                if (serverSide){
                    let formData = new FormData();

                    for (let i = 0; i < files.length; i++) {
                        let file = files[i];
                        formData.append('uploads[]', file, file.name);
                    }

                    $.ajax({
                        url: '/cadena-trasplantaments',
                        type: 'POST',
                        data: formData,
                        dataType: 'json',
                        processData: false,
                        contentType: false,
                        success: updateIdentifiers,
                        xhr: function () {
                            let xhr = new XMLHttpRequest();

                            // listen to the 'progress' event
                            xhr.upload.addEventListener('progress', function (evt) {

                                if (evt.lengthComputable) {
                                    let percentComplete = evt.loaded / evt.total;
                                    percentComplete = parseInt(percentComplete * 100);

                                    $progress_bar.text(percentComplete + '%');
                                    $progress_bar.width(percentComplete + '%');

                                    if (percentComplete === 100) {
                                        $('.progress-bar').html('Fet');
                                    }
                                }
                            }, false);
                            return xhr;
                        }
                    });
                }
                else{
                    let filesData = {};
                    for (let i = 0; i < files.length; i++) {
                        let f = files[i];
                        let fr = new FileReader();
                        fr.onload = (function(file){
                            let nomFitxer = file.name;
                            // imperativo entender como leches funciona esto
                            // https://stackoverflow.com/questions/16937223/pass-a-parameter-to-filereader-onload-event
                            return function(e){
                                let object = new OptimitzadorTransplants(JSON.parse(e.target.result), descendent);
                                objects[object.hashCode()] = object;
                                filesData[object.hashCode().toString()] = nomFitxer;
                                if(!selectedHash){
                                    // The default selected file is the first
                                    // on to be loaded
                                    selectedHash = object.hashCode();
                                }
                                if(i === files.length - 1){
                                    fileName = filesData;
                                    updateFilesTable(filesData);
                                    updateSummary(objects[selectedHash].getSummary());
                                }
                            };
                        })(f);
                        fr.readAsText(f);
                    }
                }
            }
        });

        $('.reset-btn').on('click', function () {
            resetLlista($(this).attr('data-llista'));
            loadPatientChain(previousDonor, previousDepth);
        });

        $('#ignorar-prob-fallada').on('change', function () {
            if (previousDepth && previousDonor) {
                loadPatientChain(previousDonor, previousDepth);
            }
        });

        $(window).resize(function() {
            updateChainTableHeaders();
        });
    }

    /**
     * Actualitza les capçaleres de la taula de la cadena de trasplantaments
     * segons l'amplada de la pantalla
     */
    function updateChainTableHeaders() {
        let width = $(window).width();
        let $headers = $('#chainsTable thead tr th');

        if (width<=480) {
            $headers.get(0).innerHTML = "O";
            $headers.get(1).innerHTML = "D";
            $headers.get(2).innerHTML = "R";
        }
        else {
            $headers.get(0).innerHTML = "Ordre";
            $headers.get(1).innerHTML = "Donant";
            $headers.get(2).innerHTML = "Receptor";
        }
    }

    /**
     * Inicialitza la llista del tipus passat com argument
     *
     * @param {string} tipus - tipus de llista
     */
    function resetLlista(tipus) {
        switch (tipus) {
            case 'proves':
                resultatsProvaEncreuada = [];
                updatePanellProvaEncreuada(resultatsProvaEncreuada);
                break;
            case 'receptors':
                ignoraReceptors = [];
                updatePanellReceptorsIgnorats(ignoraReceptors);
                break;
            case 'donants':
                ignoraDonants = [];
                updatePanellDonantsIgnorats(ignoraDonants);
                break;
            case 'confirmats':
                confirmats = [];
                updatePanellTransplantsConfirmats(confirmats);
                updateAltruistsTable(originalAltruists);
                $('#data-chains').toggle(false);
                break;
            default:
                console.error("No s'ha definit el tipus de reset", tipus);
        }
    }

    /**
     * Actualitza el resum de les dades carregades amb la informació passada
     * com argument.
     *
     * @param {{origin: string, description: string, altruists: (string[])}} summary - diccionari de dades
     */
    function updateSummary(summary) {

        $('.progress').toggle(false);
        $('#originNode').html(summary.origin);
        $('#descriptionNode').html(summary.description);
        $('#fitxerNode').html(fileName[selectedHash]);

        originalAltruists = summary.altruists;
        updateAltruistsTable(summary.altruists.slice());

        $('#file-uploader').toggle(false);
        $('#llistats').toggle(false);
        $('#data-summary').toggle(true);
        $('#data-chains').toggle(false);
    }

    /**
     * Updates the identifier and summary panels.
     *
     * @param {Object} response - Key: TransplantOptimizer hash. Value: file
     * name.
     */
    function updateIdentifiers(response){
        fileName = response;
        updateFilesTable(response);
        updateSummaryFromServer(selectedHash);
        $.LoadingOverlay("hide", true);
    }

    /**
     * Obtains the summary of the TrasplantOptimitzer identified by the
     * parameter and updates the summary panel.
     *
     * @param {string} hash - Hash of the selected file (is the same as the
     * TransplantOptimizer represented by).
     */
    function updateSummaryFromServer(hash){
        let params = {"id": hash};

        $.ajax({
            url: '/resum',
            type: 'GET',
            data: params,
            dataType: 'json',
            contentType: false,
            success: updateSummary
        });
    }

    /**
     * Updates the loaded files panel.
     *
     * @param {{hash: string}} filesData - Loaded files. The key is the
     * hash of the file and the value is the name of the file that represents.
     */
    function updateFilesTable(filesData){
        let $tableBody = $('#filesTable').find('tbody');
        $tableBody.html('');

        for (const hash in filesData){
            let fileName = filesData[hash];
            let $row = $("<tr data-id='" + hash + "'><td>" + fileName + "</td><td>" + hash + "</td></tr>");
            $tableBody.append($row);
            $row.on('click', function(){
                selectedHash = $(this).attr('data-id');
                if(serverSide){
                    updateSummaryFromServer(selectedHash);
                }
                else{
                    updateSummary(objects[selectedHash].getSummary());
                }
            });
            if(!selectedHash){
                selectedHash = hash;
            }
        }
        return selectedHash;
    }

    /**
     * Actualitza el llistat de donants altruistes.
     *
     * @param {Array.<string>} altruistsData - array de donants altruistes
     */
    function updateAltruistsTable(altruistsData) {
        currentAltruists = altruistsData.slice();

        let $tableBody = $('#altruistsTable').find('tbody');

        $tableBody.html('');

        for (const altruistID of altruistsData) {
            let $row = $("<tr data-id='" + altruistID + "'><td title='Selecciona al donant " + altruistID + " per iniciar la cadena'>" + altruistID + "</td></tr>");
            $tableBody.append($row);
            $row.on('click', function () {
                let patientId = $(this).attr('data-id');
                let depth;
                let correcte;

                do {
                    correcte = true;
                    depth = window.prompt("Introdueix la profunditat per generar la cadena de trasplantament: ", "3");

                    if (isNaN(depth)) {
                        alert("Error: la profunditat ha de ser un número i ha de ser igual a 1 o superior");
                        correcte = false;
                    }
                    else if (depth < 1) {
                        alert("Error: la profunditat mínima ha de ser 1");
                        correcte = false;
                    }
                } while (!correcte);

                loadPatientChain(patientId, depth);
            });
        }
    }

    /**
     * Envia la petició al servidor demanant la cadena de trasplantament
     * optimizada pel donant passat com argument afegint al llistat
     * corresponent el donant ignorat, el receptor ignorat o el resultat
     * positiu de la prova encreuada.
     *
     * La petició tindrà en compte els llistats de donants i receptors
     * ignorats, la profunditat i els resultats de la prova encreuada,
     * incloent-hi els nous elements passats com argument.
     *
     * @param {number} patientId - id del donant
     * @param {number} depth - profunditat a explorar
     * @param {number} [ignoraDonant] - id del nou donant a ignorar
     * @param {number} [ignoraReceptor] - id del nou receptor a ignorar
     * @param {string} [resultatProvaEncreuada] - parella per la què ha donat
     * positiva la prova encreuada
     */
    function loadPatientChain(patientId, depth, ignoraDonant, ignoraReceptor, resultatProvaEncreuada) {
        let ignorarFallada = $('#ignorar-prob-fallada').prop('checked');

        if (ignoraDonant) {
            ignoraDonants.push(ignoraDonant);
            updatePanellDonantsIgnorats(ignoraDonants);
        }
        if (ignoraReceptor) {
            ignoraReceptors.push(ignoraReceptor);
            updatePanellReceptorsIgnorats(ignoraReceptors);
        }
        if (resultatProvaEncreuada) {
            resultatsProvaEncreuada.push(resultatProvaEncreuada);
            updatePanellProvaEncreuada(resultatsProvaEncreuada);
        }

        previousDepth = depth;
        previousDonor = patientId;

        $.LoadingOverlay("show");

        // Creem una copia dels arrays de donants i receptors ignorats per no
        // modificar els originals
        let auxIgnoraDonants = ignoraDonants.slice();
        let auxIgnoraReceptors = ignoraReceptors.slice();

        // esta copia no es necesaria si se hace en el servidor - mejora pequeña
        for (let i = 0; i < confirmats.length; i++) {
            auxIgnoraDonants.push(confirmats[i].donant);
            auxIgnoraReceptors.push(confirmats[i].receptor);
        }
        if (serverSide){
            let body = {
                "id": selectedHash,
                "profunditat": depth,
                "pacient": patientId,
                "donantsIgnorats": auxIgnoraDonants,
                "receptorsIgnorats": auxIgnoraReceptors,
                "provesEncreuades": resultatsProvaEncreuada,
                "ignorarFallada": ignorarFallada
            };
            $.LoadingOverlay("show");
            $.ajax({
                url: '/cadena-trasplantaments',
                type: 'PUT',
                data: JSON.stringify(body),
                dataType: 'json',
                processData: false,
                contentType: 'application/json',
                success: updateChains
            });
        }
        else{
            let cadena = objects[selectedHash].buildChain(
                depth, patientId, auxIgnoraDonants, auxIgnoraReceptors, resultatsProvaEncreuada, ignorarFallada
            );
            updateChains(cadena);
            $.LoadingOverlay("hide", true);
        }
    }

    /**
     * Actualitza la taula de la cadena de trasplantament amb les dades
     * retornades pel servidor.
     *
     * @param {Chain} dades - dades de la cadena de trasplantament
     */
    function updateChains(dades) {
        let $tableBody = $('#chainsTable').find('tbody');

        chainsDataTable.clear();
        $tableBody.html('');

        $('#altruistNode').html(previousDonor);
        $('#depthNode').html(previousDepth);


        for (let i = 0; i < dades.length; i++) {
            let $row = $("<tr>" +
                "<td class='center'>" + (i + 1) + "</td>" +
                "<td class='center'>" + dades[i].donant +
                " <i title='Ignorar el donant: " + dades[i].donant + "' class='fa fa-times " + (i > 0 ? "vermell" : 'transparent') + "' data-donant-id='" + dades[i].donant + "'></i>" +
                "</td>" +
                "<td class='center'>" + dades[i].receptor +
                " <i title='Ignorar el receptor: " + dades[i].receptor + "' class='fa fa-times vermell' data-receptor-id='" + dades[i].receptor + "'></i>" +
                "</td>" +
                "<td class='center baixa-prioritat'>" + dades[i].probExit + "</td>" +
                "<td class='right baixa-prioritat'>" + dades[i].valor.toFixed(2) + "</td>" +
                "<td class='center vermell'><i title=\"Afegir com a resultat positiu de la prova d'encreuament el parell: " + dades[i].receptor + "-" + dades[i].donant + "\" class='fa fa-plus' data-prova-encreuada-id='" + dades[i].receptor + "-" + dades[i].donant + "'></i></td>" +
                "<td class='center verd'><i title=\"Confirmar transplant\" class='fa fa-lock' data-confirmar-index='" + i + "'></i></td>" +
                "</tr>");

            let $donantIcon = $row.find('[data-donant-id]');
            $donantIcon.on('click', function () {
                let donantId = $(this).attr('data-donant-id');
                loadPatientChain(previousDonor, previousDepth, donantId);
            });

            let $receptorIcon = $row.find('[data-receptor-id]');
            $receptorIcon.on('click', function () {
                let receptorId = $(this).attr('data-receptor-id');
                loadPatientChain(previousDonor, previousDepth, null, receptorId);
            });

            let $provaEncreuadaIcon = $row.find('[data-prova-encreuada-id]');

            $provaEncreuadaIcon.on('click', function () {
                let provaEncreuadaId = $(this).attr('data-prova-encreuada-id');
                loadPatientChain(previousDonor, previousDepth, null, null, provaEncreuadaId);
            });

            let $confirmarIcon = $row.find('[data-confirmar-index]');
            $confirmarIcon.on('click', function () {
                let index = $(this).attr('data-confirmar-index');
                confirmarTransplants(dades, index);
            });

            chainsDataTable.row.add($row).draw();
        }

        $('#data-chains').toggle(true);
        $('#llistats').toggle(true);
        $.LoadingOverlay("hide", true);
    }

    /**
     * Actualitza el panell de proves encreuades amb les dades passades com
     * argument.
     *
     * @param {Array} dades - array de parelles receptor-donant que han donat
     * positiu en la prova encreuada.
     */
    function updatePanellProvaEncreuada(dades) {
        let $llista = $('#ignora-prova-encreuada tbody');
        $llista.html('');

        for (let i = 0; i < dades.length; i++) {
            let parell = dades[i].split('-');
            let $row = $('<tr>' +
                '<td>' + parell[0] + '</td>' +
                '<td>' + parell[1] + '</td>' +
                '<td class="center"><i title="Anula el resultat positiu de la prova encreuada per : ' +
                dades[i] + '" class="fa fa-undo verd" data-prova-id="' + dades[i] + '"></i></td>' +
                +'</tr>'
            );

            $llista.append($row);

            let $icon = $row.find('[data-prova-id]');
            $icon.on('click', function () {
                let parell = $(this).attr('data-prova-id');
                let index = dades.indexOf(parell);
                dades.splice(index, 1);
                updatePanellProvaEncreuada(dades);
                loadPatientChain(previousDonor, previousDepth);
            });
        }
    }

    /**
     * Actualitza el panell de receptors ignorats amb les dades passades com
     * argument
     *
     * @param {Array.<string>} dades - array amb els id dels receptors ignorats
     */
    function updatePanellReceptorsIgnorats(dades) {
        let $llista = $('#ignora-receptors tbody');
        $llista.html('');

        for (let i = 0; i < dades.length; i++) {
            let $row = $('<tr>' +
                '<td>' + dades[i] + '</td>' +
                '<td class="center"><i title="Restaura el receptor: ' + dades[i] +
                '" class="fa fa-undo verd" data-receptor-id="' + dades[i] + '"></i></td>' +
                '</tr>'
            );

            $llista.append($row);

            let $icon = $row.find('[data-receptor-id]');
            $icon.on('click', function () {
                let parell = $(this).attr('data-receptor-id');
                let index = dades.indexOf(parell);
                dades.splice(index, 1);
                updatePanellReceptorsIgnorats(dades);
                loadPatientChain(previousDonor, previousDepth);
            });
        }
    }

    /**
     * Actualitza el panell de donants ignorats amb les dades passades com
     * argument.
     *
     * @param {Array.<string>} dades - array amb els id dels donants ignorats
     */
    function updatePanellDonantsIgnorats(dades) {
        let $llista = $('#ignora-donants tbody');
        $llista.html('');

        for (let i = 0; i < dades.length; i++) {
            let $row = $('<tr>' +
                '<td>' + dades[i] + '</td>' +
                '<td class="center"><i title="Restaura el donant: ' + dades[i] + '" class="fa fa-undo verd" data-donant-id="' + dades[i] + '"></i></td>' +
                +'</tr>'
            );
            $llista.append($row);

            let $icon = $row.find('[data-donant-id]');
            $icon.on('click', function () {
                let parell = $(this).attr('data-donant-id');
                let index = dades.indexOf(parell);
                dades.splice(index, 1);
                updatePanellDonantsIgnorats(dades);
                loadPatientChain(previousDonor, previousDepth);
            });
        }
    }

    /**
     * Mostra la secció de càrrega principal.
     */
    function mostrarLoader() {
        $.LoadingOverlay("hide", true);
        $('#file-uploader').toggle(true);
        $('#data-chains').toggle(false);
        $('#llistats').toggle(false);
        $('#data-summary').toggle(false);
    }

    /**
     * Inicialitza les taules que utilitzen la biblioteca DataTable.
     */
    function inicialitzarTaules() {
        let opcions = {
            language: {
                "sProcessing": "Processant...",
                "sLengthMenu": "Mostra _MENU_ registres",
                "sZeroRecords": "No s'han trobat registres.",
                "sInfo": "Mostrant de _START_ a _END_ de _TOTAL_ registres",
                "sInfoEmpty": "Mostrant de 0 a 0 de 0 registres",
                "sInfoFiltered": "(filtrat de _MAX_ total registres)",
                "sInfoPostFix": "",
                "sSearch": "Filtrar:",
                "sUrl": "",
                "oPaginate": {
                    "sFirst": "Primer",
                    "sPrevious": "Anterior",
                    "sNext": "Següent",
                    "sLast": "Últim"
                }
            }
        };
        chainsDataTable = $('#chainsTable').DataTable(opcions);
        updateChainTableHeaders();
    }

    /**
     * Confirma els trasplantaments fins a l'index passat com argument, de
     * manera que els donants i receptors passan a ser ignorats i s'afegeixen
     * els donants associats a l'últim receptor a la llista de donants
     * altruistres.
     *
     * @param {Chain} dades - Cadena de trasplantaments generada.
     * @param {number} index - Representa l'índex de l'últim pacient el qual
     * formarà part dels trasplantaments confirmats.
     */
    function confirmarTransplants(dades, index) {
        // Donants associats a l'últim pacient, que correspon amb l'index
        let donantsAssociats = objects[selectedHash].getDonantsDeReceptor(
            dades[index].receptor
        );
        let altruistaActual = Number(dades[0].donant);
        let indexAltruistaActual = currentAltruists.indexOf(altruistaActual);
        currentAltruists.splice(indexAltruistaActual, 1);
        currentAltruists = currentAltruists.concat(donantsAssociats);

        updateAltruistsTable(currentAltruists);

        for (let i = 0; i <= index; i++) {
            confirmats.push({
                donant: dades[i].donant,
                receptor: dades[i].receptor
            });
        }

        $('#data-chains').toggle(false);
        updatePanellTransplantsConfirmats(confirmats);

    }

    /**
     * Calls a prompt that allows to download the compatibility graph.
     *
     * @param {Object} compatibilityGraph - compatibility graph to be
     * downloaded.
     */
    function downloadUpdatedFile(compatibilityGraph) {
        let content = JSON.stringify(compatibilityGraph, null, 2);
        download(filename, content);
    }

    /**
     * Calls a prompt that allows to download a file.
     *
     * @param {string} filename - File name that is going to be downloaded.
     * @param {string} content - The content of the file.
     */
    function download(filename, content){
        let element = document.createElement('a');
        element.setAttribute(
            'href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content)
        );
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }

    /**
     * Updates the confirmed transplants panel.
     *
     * @param {Array.<{donant: string, receptor: string}>} confirmats -
     * Transplants that are confirmed.
     */
    function updatePanellTransplantsConfirmats(confirmats) {
        var $llista = $('#transplants-confirmats tbody');

        $llista.html('');

        for (var i = 0; i < confirmats.length; i++) {
            var $row = $('<tr>' +
                '<td>' + confirmats[i].donant + '</td>' +
                '<td>' + confirmats[i].receptor + '</td>' +
                '</tr>'
            );

            $llista.append($row);
        }
    }

/* =============================================================================
 *
 * Website initialization
 *
 * ========================================================================== */

    inicialitzarListeners();
    inicialitzarTaules();
    mostrarLoader();
});



