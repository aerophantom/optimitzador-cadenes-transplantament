export default class TransplantOptimizer{

    /**
     *
     * @param _compatibilityGraph
     */
    constructor(_compatibilityGraph){
        this._CompatibilityGraph = _compatibilityGraph;
        this._Recipients = null;
        this._Donors = null;
        this._AssociatedDonors = {};
        this._IgnoredDonors = [];
        this._IgnoredRecipients = [];
        this._IgnoreFailureProbability = false;
        this._HashCodeComputed = false;
        this._Log = {
            "candidates": [],
            "crossed_tests": [],
            "errors": []
        };
    }

    /**
     * Inicialitza els receptors creant una còpia del contingut de la memòria i
     * eliminant els receptors passats com argument.
     * TODO
     */
    inicialitzarReceptors(kwargs = {}) {
        let ignoredRecipients = kwargs.ignoredRecipients || [];
        let ignoredDonors = kwargs.ignoredDonors || [];

        this._Recipients = JSON.parse(JSON.stringify(this._CompatibilityGraph.patients));

        if (ignoredRecipients) {
            for(const ignoredRecipient of ignoredRecipients){
                this._IgnoredRecipients.push(ignoredRecipient);
                delete this._Recipients[ignoredRecipient];
            }
        }

        this._AssociatedDonors = {};

        for (let recipientId in this._Recipients) {
            for (const donor of this._Recipients[recipientId].related_donors) {
                if (ignoredDonors && ignoredDonors.includes(donor)) {
                    this._IgnoredDonors.push(donor);
                }
                else{
                    this._AssociatedDonors[donor] = recipientId;
                }
            }
        }
    }

    /**
     *
     * Inicialitza el llistat de donants, a partir dels donants compatibles de
     * la llista de receptors, tenint en compte la llista de donants ignorats.
     *
     * Els receptors associats als donants ignorats són exclosos del llistat de
     * receptors.
     * TODO
     */
    inicialitzarDonants(kwargs = {}) {
        let ignoredDonors = kwargs.ignoredDonors || [];

        this._Donors = {};

        if (ignoredDonors) {
            for(const ignoredDonor of ignoredDonors){
                let associatedRecipient = this._AssociatedDonors[ignoredDonor];

                if (associatedRecipient) {
                    // Eliminem el donant associat del receptor
                    let donantsAssociatsAlReceptor = this._Recipients[associatedRecipient].related_donors;
                    let index = donantsAssociatsAlReceptor.indexOf(ignoredDonor);
                    donantsAssociatsAlReceptor.splice(index, 1);
                    this._IgnoredDonors.push(ignoredDonor);

                    // Si no hi ha cap donant associat al receptor, s'elimina
                    // de la llista de receptors
                    if (donantsAssociatsAlReceptor.length === 0) {
                        this._IgnoredRecipients.push(associatedRecipient);
                        delete this._Recipients[associatedRecipient];
                    }
                }
            }
        }
        for (let recipientId in this._Recipients) {
            for (const donant of this._Recipients[recipientId].compatible_donors) {
                // TODO aixo es pot refactoritzar
                if (ignoredDonors && ignoredDonors.includes(donant.donor)) {
                    // No s'afegeixen els donants ignorats
                    continue;
                }
                if (!this._Donors[donant.donor]) {
                    this._Donors[donant.donor] = {};
                }
                this._Donors[donant.donor][recipientId] = donant;
            }
        }
    }

    /**
     * Retorna un array de diccionari de dades amb els receptors compatibles
     * amb el donant associat al receptor passat com argument.
     *
     * @param {Object} parell - tupla que conté la informació d'un donant i un
     * receptor.
     * @returns {Array} - array de tuples de dades amb els receptors
     * compatibles amb el donant associat.
     */
    succMultipleDonors(parell) {
        let donantsAssociats = this._CompatibilityGraph.patients[parell.receptor].related_donors;
        let successors = [];

        for (const donor of donantsAssociats) {
            if (!this._IgnoredDonors.includes(donor)) {
                let auxSuccessors = this.succDonant(donor);

                for (const recipient of auxSuccessors) {
                    successors.push({receptor: recipient, donant: donor});
                }
            }
        }
        return successors;
    }

    /**
     * Retorna un array de dades amb els receptors compatibles amb el donant
     * passat com argument.
     *
     * @param {int} donorId - identificador del donant
     * @returns {Array} - array de dades amb els receptors compatibles amb el
     * donant.
     * @private
     */
    succDonantMultipleDonors(donorId) {
        let successors = [];

        if (!this._IgnoredDonors.includes(donorId)) {
            let auxSuccessors = this.succDonant(donorId);

            for (const recipient of auxSuccessors) {
                successors.push({receptor: recipient, donant: donorId});
            }
        }
        return successors;
    }

    /**
     * Retorna un array amb els identificadors dels receptors compatibles amb
     * el donant corresponent al id passat com argument.
     *
     * @param {number} donorId - id del donant
     * @returns {Array} - array amb els identificadors dels receptors
     * compatibles amb el donant.
     */
    succDonant(donorId) {
        if (donorId === -1 || !this._Donors[donorId]) {
            return [];
        }
        return Object.keys(this._Donors[donorId]);
    }

    /**
     * Retorna la probabilitat d'èxit d'un trasplantament entre el donant i el
     * receptor passats com argument.
     *
     * @param {number} donorId - id del donant
     * @param {number} recipientId - id del receptor
     * @returns {number} - probabilitat d'èxit del trasplantament
     */
    spDonant(donorId, recipientId) {
        let p = 1;
        if (!this._IgnoreFailureProbability) {
            p = 1 - this._Donors[donorId][recipientId].failure_prob;
        }
        return p;
    }

    /**
     * Retorna la puntuació de trasplantament entre el parell donant-receptor
     *
     * @param {Object} parell - tupla que conté la informació d'un donant i
     * un receptor
     * @returns {number} - puntuació del trasplantament
     */
    scoreMultipleDonors(parell) {
        return this.scoreDonant(parell.donant, parell.receptor);
    }

    /**
     * Retorna la puntuació de trasplantament entre el donant i el receptor
     * passats com argument.
     *
     * @param {number} donant - id del donant
     * @param {number} receptor - id del receptor
     * @returns {number} - puntuació del trasplantament
     * @private
     */
    scoreDonant(donant, receptor) {
        let puntuacio;

        if (!this._Donors[donant][receptor]) {
            this._Log.errors.push(
                "El receptor [" + receptor +
                "]no és compatible amb el donant [" + donant + "]"
            );
        } else {
            puntuacio = this._Donors[donant][receptor].score;
        }

        return puntuacio;
    }

    /**
     * Funció auxiliar per eliminar múltiples elements d'un conjunt de donants.
     *
     * @param {Array} conjuntA - array del que s'eliminaran els elements
     * @param {Array} conjuntB - elements a eliminar
     * @private
     */
    eliminarElementsDelConjuntMultipleDonors(conjuntA, conjuntB) {
        let nouConjunt = [];

        for (const elemA of conjuntA) {
            if (!conjuntB.includes(elemA.receptor)) {
                nouConjunt.push(elemA);
            }
        }
        return nouConjunt;
    }

    /**
     * Crea un array ordenat de tuples amb la informació corresponent als
     * arrays passats per argument ordenat per val.
     *
     * @param {Array} S - array amb les dades a ordenar
     * @param {Array} val - array de valors corresponents a S
     * @returns {Array} - array de tuples amb la informació passada per
     * paràmetres ordenada incrementalment
     * @private
     */
    obtenirConjuntOrdenatPerValor(S, val) {
        let T = [];

        for (let i = 0; i < S.length; i++) {
            T.push({
                receptor: S[i],
                valor: val[i]
            });
        }
        T.sort(function (a, b) {
            return b.valor - a.valor;
        });
        return T;
    }

    /**
     * Retorna la puntuació acumulada esperada a obtenir de la cadena originada
     * a rec que no inclou cap receptor de rec_list.
     * La funció només explora els primers nivells de profunditat (a partir de
     * rec)
     *
     * @param {number} rec - id del receptor
     * @param {Array} rec_list - array amb els id dels elements a ignorar (els
     * receptors processats anteriorment)
     * @param {number} depth - profunditat a explorar.
     */
    ExpUtMultipleDonors(rec, rec_list, depth) {
        // S és el llistat de receptors successors com a tupla a la que s'ha
        // afegit la dada "donant_candidat"
        let S = this.succMultipleDonors(rec);

        S = this.eliminarElementsDelConjuntMultipleDonors(S, rec_list);
        rec_list = rec_list.slice();


        // Aquesta és la condició que finalitza la recursió
        if (S.length === 0 || depth === 0) {
            return 0;
        } else {
            let val = [];

            let receptor = isNaN(rec) ? rec.receptor : rec;
            for (let s of S) {
                if (!rec_list.includes(receptor)) {
                    rec_list.push(receptor); // [rec | rec_list]
                }

                val.push(
                    // Només cal passar el receptor perquè inclou la referència
                    // al donant candidat
                    this.ExpUtMultipleDonors(s, rec_list, depth - 1) + this.scoreMultipleDonors(s)
                );
            }
            // Llista d'elements de S ordenats incrementalment pel seu val.
            let T = this.obtenirConjuntOrdenatPerValor(S, val);
            return this.sumatoriProbabilitatsMultipleDonants(T);
        }
    }

    /**
     * Sumatori dels valors segons l'algorisme (transparència 38).
     *
     * @param {Array} T - array de tuples que conté la informació sobre els
     * successors (receptors compatibles amb el donant associat al receptor) i
     * el valor calculat corresponent
     * @returns {number} - valor calculat
     */
    sumatoriProbabilitatsMultipleDonants(T) {
        let sumatori = 0;

        for (let i = 0; i < T.length; i++) {
            // Alerta, en la formula és val(ti), estan coordinats per l'índex
            // (val[i] correspon al valor de T[i]
            sumatori += this.spDonant(T[i].receptor.donant, T[i].receptor.receptor) * T[i].valor * this.productoriProbabilitatMultipleDonants(i, T);
        }
        return sumatori;
    }

    /**
     * Productori dels valors segons l'algorisme (transparència 32).
     *
     * @param {number} i -  índex a partir del qual es comença a iterar.
     * @param {Array} T - array de tuples que conté la informació sobre els
     * successors (receptors compatibles amb el donant associat al receptor) i
     * el valor calculat corresponent
     * @returns {number} - valor calculat
     */
    productoriProbabilitatMultipleDonants(i, T) {
        let productori = 1;

        if (!this._IgnoreFailureProbability) {
            for (let j=0; j<i; j++) {
                productori *= 1 - this.spDonant(T[j].receptor.donant, T[j].receptor.receptor);
            }
        }
        return productori;
    }

    /**
     * Genera una cadena de trasplantament optimitzada a partir d'un donant
     * altruista tenint en compte la profunditat màxima a explorar, els donants
     * i receptors a ignorar i els resultats de les proves encreuades.
     *
     * @param {number} depth - profunditat màxima a explorar
     * @param {String} altruist - id del donant altruista que inicia la cadena
     * @param {Array} ignoredDonors - array de id de donants a ignorar
     * @param {Array} ignoredRecipients - array de id de receptors a ignorar
     * @param {Array} resultatsProvaEncreuada - array de cadenes de text amb
     * les parelles de la prova encreuada que han donat positiu
     * @param {boolean} ignorarFallada - indica si es ignora la probabilitat de
     * fallada.
     * @returns {Array} - array de tuples amb les dades de trasplantament.
     * @public
     */
    //TODO sugerencia, muchos de estos parametros no son obligatorios, podria
    //hacer uso del kwargs o algo asi
    buildChain(depth, altruist, kwargs = {}) {//ignoredDonors, ignoredRecipients, crossedTests, ignorarFallada) {
        let current = altruist;
        let no_more_transplantations;
        let cadenaTransplants = [];
        let resultatsProvaEncreuada = kwargs.crossedTests || [];

        this._IgnoredDonors = [];
        this._IgnoredRecipients = [];
        this._IgnoreFailureProbability = kwargs.ignorarFallada || false;

        this.inicialitzarReceptors(kwargs);
        this.inicialitzarDonants(kwargs);

        do {
            let S;
            if (current === altruist) {
                S = this.succDonantMultipleDonors(altruist);
            } else {
                S = this.succMultipleDonors(current);
            }

            let val = [];

            for (let recipient of S) {
                val.push(
                    this.ExpUtMultipleDonors(recipient, [], depth) +
                    this.scoreMultipleDonors(recipient)
                );
            }

            this._Log.crossed_tests = [];
            // Llista d'elements de S ordenats incrementalment pel seu val.
            let T = this.obtenirConjuntOrdenatPerValor(S, val);
            no_more_transplantations = true;

            //TODO refactoritzable for of a la espera de un nombre adecuado.
            for (let i = 0; i < T.length; i++) {
                let donant = current === altruist ? altruist : T[i].receptor.donant;
                let receptor = T[i].receptor.receptor;

                if (TransplantOptimizer.provaEncreuada(resultatsProvaEncreuada, donant, receptor)) {
                    // Si el resultat de la prova és positiu no es pot fer el
                    // trasplantament
                    this.eliminarDonantCompatibleDeReceptor(donant, receptor);
                    this._Log.crossed_tests.push(
                        {"donor": donant, "receiver": receptor}
                    );
                    continue;

                } else {
                    let dadesTransplant = {
                        receptor: receptor,
                        donant: donant,
                        probExit: this.spDonant(donant, receptor),
                        valor: T[i].valor
                    };
                    cadenaTransplants.push(dadesTransplant);
                    delete this._Donors[dadesTransplant.donant];
                    this.eliminarReceptor(dadesTransplant.receptor);
                    current = T[i].receptor;
                    no_more_transplantations = false;
                }
                break;
            }

        } while (!no_more_transplantations);

        this._Log.candidates = cadenaTransplants;
        return cadenaTransplants;
    }

    /**
     * Retorna el resultat de la prova encreuada pel donant i receptor passats
     * com argument.
     *
     * @param {Array} resultatsProva - array amb els resultats de les proves
     * encreuades
     * @param {number} donant - id del donant
     * @param {number} receptor - id del receptor
     * @returns {boolean} - Cert si la prova és positiva o fals en cas contrari
     */
    static provaEncreuada(resultatsProva, donant, receptor) {
        //TODO refactoritzable
        if (!resultatsProva || !donant || !receptor) {
            return false;
        } else {
            return resultatsProva.includes(receptor + "-" + donant);
        }
    }

    /**
     * Elimina un donant de la llista de donants compatibles d'un receptor.
     *
     * @param {number} donorId - id del donant
     * @param {number} recipientId - id del receptor
     */
    eliminarDonantCompatibleDeReceptor(donorId, recipientId) {
        // Eliminem l'associació del donant amb el receptor
        delete this._Donors[donorId][recipientId];

        // Eliminem el donant de la llista de donants compatibles del receptor
        let donantsCompatibles = this._Recipients[recipientId].compatible_donors;
        let index = -1;

        for (let i = 0; i < donantsCompatibles.length; i++) {
            if (donantsCompatibles[i].donor === donorId) {
                index = i;
                break;
            }
        }

        if (index === -1) {
            this._Log.errors.push(
                "no s'ha trobat el donant associat " + donorId +
                " com a donant compatible de " + recipientId
            );
        } else {
            donantsCompatibles.splice(index, 1);
        }
    }

    /**
     * Elimina un receptor de la llista de receptors i els seus donants
     * associats
     *
     * @param {number} recipientId - id del receptor
     */
    eliminarReceptor(recipientId) {
        let donantsCompatibles = this._Recipients[recipientId].compatible_donors;

        for (const donantCompatible of donantsCompatibles) {
            if (this._Donors[donantCompatible.donor]) {
                delete this._Donors[donantCompatible.donor][recipientId];
            }
        }
        delete this._Recipients[recipientId];
    }

    /**
     * Obtains the related donors of the recipient passed by parameter.
     *
     * @param recipientId
     * @returns {number[]}
     */
    getDonantsDeReceptor(recipientId) {
        return this._CompatibilityGraph.patients[recipientId].related_donors;
    }

    /**
     *
     * @param string
     * @returns {number}
     */
    static _computeHashCode(string) {
        //TODO seria millor posar-lo en un altre lloc, crec →
        // al prototype d'String
        let hash = 0, i, chr;
        if (string.length === 0) return hash;
        for (i = 0; i < string.length; i++) {
            chr   = string.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }

    /**
     *
     * @returns {boolean}
     */
    get hashCode(){
        //TODO esta representacion del hashcode indica que el objeto seria como
        // inmutable, asi le cambiemos el loadedData (Que no se como se podria)
        // siempre retornaria el mismo hashcode.
        if (!this._HashCodeComputed){
            this._HashCodeComputed = TransplantOptimizer._computeHashCode(
                JSON.stringify(this._CompatibilityGraph)
            );
        }
        return this._HashCodeComputed;
    }

    get log(){
        let logAsText =  ">LOG: {}\n".format(Utils.currentDateTime);
        logAsText += ">TRASPLANTAMENTS:\n";
        logAsText += "DONANT;RECEPTOR;PROBABILITAT_EXIT;VALOR\n";

        for(const transplantation of this._Log.candidates){
            logAsText += "{};{};{};{}\n".format(
                transplantation.donant, transplantation.receptor,
                transplantation.probExit, transplantation.valor
            );
        }

        logAsText += ">POSITIUS PROVES CREUADES\n";
        logAsText += "DONANT;RECEPTOR\n";
        for(const positive of this._Log.crossed_tests){
            logAsText += "{};{}\n".format(positive.donor, positive.receiver);
        }

        return logAsText;
    }

    get summary(){
        return {
            "origin": this._CompatibilityGraph.origin,
            "description": this._CompatibilityGraph.description,
            "altruists": this._CompatibilityGraph.altruists
        };
    }

    get update(){
        //fem una copia
        let obj = JSON.parse(JSON.stringify(this._CompatibilityGraph));
        let patients = obj.patients;
        let llistatDonantsIgnoratsExtended = this._IgnoredDonors.slice();

        //eliminem primer de tot els receptors.
        for(const receptorIgnorat of this._IgnoredRecipients){
            llistatDonantsIgnoratsExtended = llistatDonantsIgnoratsExtended.concat(patients[receptorIgnorat].related_donors);
            delete patients[receptorIgnorat];
        }

        //i ara eliminem els donants.
        for(let key in patients){
            let related_donors = patients[key].related_donors;
            let difference = related_donors.filter(
                x => llistatDonantsIgnoratsExtended.includes(x)
            );
            for(const donor of difference){
                let index = related_donors.indexOf(donor);
                related_donors.splice(index, 1);
            }
            let compatible_donors = patients[key].compatible_donors;
            let index = 0;


            let compatible_donors_to_remove = [];
            for(const compatible_donor of compatible_donors){
                if(llistatDonantsIgnoratsExtended.includes(compatible_donor.donor)){
                    compatible_donors_to_remove.push(index);
                }
                index += 1;
            }
            for(const compatible_donor_to_remove of compatible_donors_to_remove){
                compatible_donors.splice(compatible_donor_to_remove, 1);
            }
        }
        return obj;
    }
}
