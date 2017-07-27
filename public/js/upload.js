$(document).ready(function () {

    var ignoraDonants = [],
        ignoraReceptors = [],
        resultatsProvaEncreuada = [],
        previousDepth,
        previousDonor,
        dadesTimestamp,
        chainsDataTable;

    /**
     * Inicialitza els detectors d'esdeveniments de l'interficie
     */
    var inicialitzarListeners = function () {
            $('.upload-btn').on('click', function () {
                $('.upload-input').val(null);
                $('.upload-input').click();
                $('.progress').toggle(true);
                $('.progress-bar').text('0%');
                $('.progress-bar').width('0%');
            });


            $('.upload-input').on('change', function () {
                var files = $(this).get(0).files;

                if (files.length > 0) {
                    var formData = new FormData();

                    for (var i = 0; i < files.length; i++) {
                        var file = files[i];
                        formData.append('uploads[]', file, file.name);
                    }

                    $.ajax({
                        url: '/upload',
                        type: 'POST',
                        data: formData,
                        dataType: 'json',
                        processData: false,
                        contentType: false,
                        success: updateSummary,
                        xhr: function () {
                            var xhr = new XMLHttpRequest();

                            // listen to the 'progress' event
                            xhr.upload.addEventListener('progress', function (evt) {

                                if (evt.lengthComputable) {
                                    var percentComplete = evt.loaded / evt.total;
                                    percentComplete = parseInt(percentComplete * 100);

                                    $('.progress-bar').text(percentComplete + '%');
                                    $('.progress-bar').width(percentComplete + '%');

                                    if (percentComplete === 100) {
                                        $('.progress-bar').html('Fet');
                                    }
                                }
                            }, false);
                            return xhr;
                        }
                    });
                }
            });

            $('.reset-btn').on('click', function () {
                resetLlista($(this).attr('data-llista'));
                loadPatientChain(previousDonor, previousDepth);
            });
        },

        /**
         * Reinicialitza totes les llistes
         */
        resetLlistes = function () {
            resetLlista('proves');
            resetLlista('receptors');
            resetLlista('donants');
        },

        /**
         * Inicialitza la llista del tipus passat com argument
         *
         * @param {string} tipus - tipus de llista
         */
        resetLlista = function (tipus) {
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

                default:
                    console.error("No s'ha definit el tipus de reset", $(this).attr('data-llista'));

            }
        },

        /**
         * Actualitza el resum de les dades carregades amb la informació passada com argument.
         *
         * @param {Object} dades - diccionari de dades
         */
        updateSummary = function (dades) {

            if (dades.status === "success") {
                $('.progress').toggle(false);
                $('#originNode').html(dades.summary.origin);
                $('#descriptionNode').html(dades.summary.description);

                updateAltruistsTable(dades.summary.altruists);

                $('#file-uploader').toggle(false);
                $('#data-chains').toggle(false);
                $('#llistats').toggle(false);
                $('#data-summary').toggle(true);

                dadesTimestamp = dades.summary.dadesTimestamp;

            } else {
                alert(dades.message);
            }

            $.LoadingOverlay("hide", true);

        },

        /**
         * Actualitza el llistat de donants altruistes.
         *
         * @param {Array} altruistsData - array de donants altruistes
         */
        updateAltruistsTable = function (altruistsData) {
            var $tableBody = $('#altruistsTable').find('tbody');

            $tableBody.html('');

            for (var i = 0; i < altruistsData.length; i++) {
                var $row = $("<tr data-id='" + altruistsData[i] + "'><td title='Selecciona al donant " + altruistsData[i] + " per iniciar la cadena'>" + altruistsData[i] + "</td></tr>");
                $tableBody.append($row);
                $row.on('click', function () {
                    var patientId = $(this).attr('data-id');
                    var depth = window.prompt("Introdueix la profunditat per generar la cadena de transplantament: ", "3");
                    loadPatientChain(patientId, depth);
                });
            }
        },

        /**
         * Envia la petició al servidor demanant la cadena de transplantament optimizada pel donant passat com argument
         * afegint al llistat corresponent el donant ignorat, el receptor ignorat o el resultat positiu de la prova
         * encreuada.
         *
         * La petició tindrà en compte els llistats de donants i receptors ignorats, la profunditat i els resultats de
         * la prova encreuada, incloent els nous elements passats com argument.
         *
         * @param {number} patientId - id del donant
         * @param {number} depth - profunditat a explorar
         * @param {number} ignoraDonant - id del nou donant a ignorar
         * @param {number} ignoraReceptor - id del nou receptor a ignorar
         * @param {string} resultatProvaEncreuada - parella per la que ha donat positiva la prova encreuada
         */
        loadPatientChain = function (patientId, depth, ignoraDonant, ignoraReceptor, resultatProvaEncreuada) {

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
            $.ajax({
                url: '/get-chains',
                type: 'GET',
                data: {
                    id: patientId,
                    depth: depth,
                    ignoraDonants: ignoraDonants,
                    ignoraReceptors: ignoraReceptors,
                    resultatsProvaEncreuada: resultatsProvaEncreuada,
                    dadesTimestamp: dadesTimestamp
                },
                dataType: 'json',

                success: function (dades) {

                    if (dades.status === 'success') {
                        updateChains(dades);

                    } else {

                        if (dades.message) {
                            alert(dades.message);
                        }

                        // Només hi han dos tipus de errors possibles:
                        // - ha canviat el fitxer
                        if (dades.summary) {
                            resetLlistes();
                            dades.summary.status = 'success';
                            updateSummary(dades);

                        } else {
                            // - No s'ha trobat cap fitxer
                            mostrarLoader();
                        }
                    }
                }
            });
        },

        /**
         * Actualitza la taula de la cadena de transplantament amb les dades retornades pel servidor.
         *
         * @param {Object} dades - dades de la cadena de transplantament
         */
        updateChains = function (dades) {

            var $tableBody = $('#chainsTable').find('tbody');
            chainsDataTable.clear();
            $tableBody.html('');

            $('#altruistNode').html(previousDonor);
            $('#depthNode').html(previousDepth);


            for (var i = 0; i < dades.chains.length; i++) {
                var $row = $("<tr>" +
                    "<td class='center'>" + (i + 1) + "</td>" +
                    "<td class='right'>" + dades.chains[i].donant +
                    " <i title='Ignorar el donant: " + dades.chains[i].donant + "' class='fa fa-times " + (i > 0 ? "vermell" : 'transparent') + "' data-donant-id='" + dades.chains[i].donant + "'></i>" +
                    "</td>" +
                    "<td class='right'>" + dades.chains[i].receptor +
                    " <i title='Ignorar el receptor: " + dades.chains[i].receptor + "' class='fa fa-times vermell' data-receptor-id='" + dades.chains[i].receptor + "'></i>" +
                    "</td>" +
                    "<td class='center baixa-prioritat'>" + dades.chains[i].probExit + "</td>" +
                    "<td class='right baixa-prioritat'>" + dades.chains[i].valor.toFixed(2) + "</td>" +
                    "<td class='center vermell'><i title=\"Afegir com a resultat positiu de la prova d'encreuament el parell: " + dades.chains[i].receptor + "-" + dades.chains[i].donant + "\" class='fa fa-plus' data-prova-encreuada-id='" + dades.chains[i].receptor + "-" + dades.chains[i].donant + "'></i></td>" +
                    "</tr>");

                if (i > 0) {
                    var $donantIcon = $row.find('[data-donant-id]');
                    $donantIcon.on('click', function () {
                        var donantId = $(this).attr('data-donant-id');
                        loadPatientChain(previousDonor, previousDepth, donantId)
                    });
                }

                var $receptorIcon = $row.find('[data-receptor-id]');
                $receptorIcon.on('click', function () {
                    var receptorId = $(this).attr('data-receptor-id');
                    loadPatientChain(previousDonor, previousDepth, null, receptorId);

                });

                var $provaEncreuadaIcon = $row.find('[data-prova-encreuada-id]');
                $provaEncreuadaIcon.on('click', function () {
                    var provaEncreuadaId = $(this).attr('data-prova-encreuada-id');
                    loadPatientChain(previousDonor, previousDepth, null, null, provaEncreuadaId)

                });

                chainsDataTable.row.add($row).draw();
            }

            $('#data-chains').toggle(true);
            $('#llistats').toggle(true);
            $.LoadingOverlay("hide", true);
        },

        /**
         * Actualitza el panell de proves encreuades amb les dades passades com argument.
         *
         * @param {Array} dades - array de parelles receptor-donant que han donat positiu en la prova encreuada.
         */
        updatePanellProvaEncreuada = function (dades) {
            var $llista = $('#ignora-prova-encreuada tbody');

            $llista.html('');

            for (var i = 0; i < dades.length; i++) {
                var parell = dades[i].split('-');
                var $row = $('<tr>' +
                    '<td>' + parell[0] + '</td>' +
                    '<td>' + parell[1] + '</td>' +
                    '<td class="center"><i title="Anula el resultat positiu de la prova encreuada per : ' +
                    dades[i] + '" class="fa fa-undo verd" data-prova-id="' + dades[i] + '"></i></td>' +
                    +'</tr>'
                );

                $llista.append($row);

                var $icon = $row.find('[data-prova-id]');
                $icon.on('click', function () {
                    var parell = $(this).attr('data-prova-id');
                    var index = dades.indexOf(parell);
                    dades.splice(index, 1);
                    updatePanellProvaEncreuada(dades);
                    loadPatientChain(previousDonor, previousDepth);
                });
            }
        },

        /**
         * Actualitza el panell de receptors ignorats amb les dades passades com argument
         *
         * @param {Array} dades - array amb els id dels receptors ignorats
         */
        updatePanellReceptorsIgnorats = function (dades) {
            var $llista = $('#ignora-receptors tbody');
            $llista.html('');

            for (var i = 0; i < dades.length; i++) {

                var $row = $('<tr>' +
                    '<td>' + dades[i] + '</td>' +
                    '<td class="center"><i title="Restaura el receptor: ' + dades[i] +
                    '" class="fa fa-undo verd" data-receptor-id="' + dades[i] + '"></i></td>' +
                    '</tr>'
                );

                $llista.append($row);

                var $icon = $row.find('[data-receptor-id]');
                $icon.on('click', function () {
                    var parell = $(this).attr('data-receptor-id');
                    var index = dades.indexOf(parell);
                    dades.splice(index, 1);
                    updatePanellReceptorsIgnorats(dades);
                    loadPatientChain(previousDonor, previousDepth);
                });
            }
        },

        /**
         * Actualitza el panell de donants ignorats amb les dades passades com argument.
         *
         * @param {Array} dades - array amb els id dels donants ignorats
         */
        updatePanellDonantsIgnorats = function (dades) {
            var $llista = $('#ignora-donants tbody');
            $llista.html('');

            for (var i = 0; i < dades.length; i++) {
                var $row = $('<tr>' +
                    '<td>' + dades[i] + '</td>' +
                    '<td class="center"><i title="Restaura el donant: ' + dades[i] + '" class="fa fa-undo verd" data-donant-id="' + dades[i] + '"></i></td>' +
                    +'</tr>'
                );
                $llista.append($row)

                var $icon = $row.find('[data-donant-id]');
                $icon.on('click', function () {
                    var parell = $(this).attr('data-donant-id');
                    var index = dades.indexOf(parell);
                    dades.splice(index, 1);
                    updatePanellDonantsIgnorats(dades);
                    loadPatientChain(previousDonor, previousDepth);
                });
            }


        },

        /**
         * Mostra la secció de carrega principal.
         */
        mostrarLoader = function () {
            $.LoadingOverlay("hide", true);
            $('#file-uploader').toggle(true);
            $('#data-chains').toggle(false);
            $('#llistats').toggle(false);
            $('#data-summary').toggle(false);
        },

        /**
         * Carrega la informació inicial del servidor.
         */
        carregaAutomaticaFitxer = function () {
            $.LoadingOverlay("show");
            $.ajax({
                url: '/autoload',
                type: 'get',
                dataType: 'json',
                success: autoCarrega
            });
        },

        /**
         * Funció cridada en fer una carrega automàtica del servidor. Si l'estat de la resposta és "success"
         * s'actualitza el resum amb les dades del servidor, en cas contrari es mostra el carregador per pujar un fitxer.
         *
         * @param {Object} dades - resposta del servidor que pot contenir el resum o un missatge d'error.
         */
        autoCarrega = function (dades) {
            if (dades.status === 'success') {
                updateSummary(dades);
            } else {
                mostrarLoader();
            }
        },

        /**
         * Inicialitza les taules que utilitzen la biblioteca DataTable.
         */
        inicialitzarTaules = function () {
            var opcions = {
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
        };

    // En aquesta secció es posa en marxa l'aplicació
    inicialitzarListeners();
    inicialitzarTaules();
    carregaAutomaticaFitxer();


});



