/**
 * MSM Smart Tools — Extension MakeCode
 * Outils pédagogiques pour robotique éducative
 * DaDa:bit + WonderCam + Thymio (via dadabit)
 *
 * 4 couleurs WonderCam (IDs confirmés) :
 * Rouge=1, Vert=2, Bleu=3, Jaune=4
 *
 * Créé par MSM-MEDIAS
 * https://msm-medias.com
 */

//% color=#0EA5E9 icon="\uf02d" block="MSM Smart Tools"
//% groups='["Init","Réglages","Capteurs ligne","Mouvements","Suivi de ligne","Vision (couleur)","Vision (chiffres)","Bras & Pince","Mission"]'
namespace msmSmartTools {

    // =========================================================
    // ÉTAT INTERNE
    // =========================================================
    let capteur1 = false
    let capteur2 = false
    let capteur3 = false
    let capteur4 = false

    // vitesses
    let vitesseToutDroit = 55
    let vitesseCorrection = 44
    let petiteVitesse = 33

    // vision couleur
    let ID_CUBE = 1
    let X_MIN = 80
    let X_MAX = 240
    let Y_APPROCHE = 237
    let SEUIL_VALIDATION = 8

    // compteurs stabilité (1 par couleur)
    let compteurStableR = 0
    let compteurStableV = 0
    let compteurStableB = 0
    let compteurStableJ = 0

    // vision chiffres
    let confianceMinNombre = 0.4
    let dernierNombre = 0
    let compteurNombreStable = 0

    // bras/pince classique (servos 5 et 6)
    let BRAS_HAUT = -60
    let BRAS_BAS = -5
    let PINCE_OUVERTE = 15
    let PINCE_FERMEE = -25
    let TEMPS_MOUVEMENT = 500
    let TEMPS_ATTENTE = 800

    // bras 3 axes pédagogique (servos 1, 2, 3)
    let BRAS3_DUREE = 1500

    // mission
    // 0 = recherche/ramassage, 1 = transport (porte un cube)
    let modeMission = 0

    // =========================================================
    // OUTILS INTERNES
    // =========================================================

    function resetStabilites(): void {
        compteurStableR = 0
        compteurStableV = 0
        compteurStableB = 0
        compteurStableJ = 0
    }

    function resetNombres(): void {
        dernierNombre = 0
        compteurNombreStable = 0
    }

    function xDansFenetre(id: number): boolean {
        const x = wondercam.XOfColorId(wondercam.Options.Pos_X, id)
        return x >= X_MIN && x <= X_MAX
    }

    function detectionStableId(id: number, seuil: number): boolean {
        let compteur = 0

        if (id == 1) compteur = compteurStableR
        else if (id == 2) compteur = compteurStableV
        else if (id == 3) compteur = compteurStableB
        else if (id == 4) compteur = compteurStableJ
        else compteur = 0

        if (wondercam.isDetectedColorId(id) && xDansFenetre(id)) {
            compteur += 1
        } else {
            compteur = 0
        }

        let ok = false
        if (compteur > seuil) {
            compteur = 0
            ok = true
        }

        if (id == 1) compteurStableR = compteur
        else if (id == 2) compteurStableV = compteur
        else if (id == 3) compteurStableB = compteur
        else if (id == 4) compteurStableJ = compteur

        return ok
    }

    function approcherId(id: number): void {
        while (wondercam.XOfColorId(wondercam.Options.Pos_Y, id) < Y_APPROCHE
            && wondercam.isDetectedColorId(id)) {
            mettreAJourCamera()
            mettreAJourCapteursLigne()
            suiviDeLigne()
        }
    }

    function nombreValideEtStableInterne(n: number, seuil: number): boolean {
        if (confianceNombre() >= confianceMinNombre) {
            let lu = nombreReconnu()

            if (lu == n) {
                if (dernierNombre == n) {
                    compteurNombreStable += 1
                } else {
                    dernierNombre = n
                    compteurNombreStable = 1
                }

                if (compteurNombreStable >= seuil) {
                    resetNombres()
                    return true
                }
            } else {
                resetNombres()
            }
        } else {
            resetNombres()
        }

        return false
    }

    // =========================================================
    // INIT
    // =========================================================

    //% block="initialiser le robot"
    //% group="Init"
    export function initialiserRobot(): void {
        dadabit.dadabit_init()
        wondercam.wondercam_init(wondercam.DEV_ADDR.x32)
        wondercam.ChangeFunc(wondercam.Functions.ColorDetect)
        brasAuRepos()
        basic.pause(500)
        resetStabilites()
        resetNombres()
        modeMission = 0
    }

    //% block="activer la reconnaissance des couleurs"
    //% group="Init"
    export function activerReconnaissanceCouleurs(): void {
        wondercam.ChangeFunc(wondercam.Functions.ColorDetect)
        resetStabilites()
    }

    //% block="activer la reconnaissance des chiffres"
    //% group="Init"
    export function activerReconnaissanceChiffres(): void {
        wondercam.ChangeFunc(wondercam.Functions.NumberRecognition)
        resetNombres()
    }

    // =========================================================
    // RÉGLAGES
    // =========================================================

    //% block="régler vitesses | tout droit %vTD | correction %vC | petite %vP"
    //% group="Réglages"
    export function reglerVitesses(vTD: number, vC: number, vP: number): void {
        vitesseToutDroit = vTD
        vitesseCorrection = vC
        petiteVitesse = vP
    }

    //% block="régler vision | couleur ID %id | X min %xmin | X max %xmax | Y approche %y | validations %seuil"
    //% group="Réglages"
    export function reglerVision(id: number, xmin: number, xmax: number, y: number, seuil: number): void {
        ID_CUBE = id
        X_MIN = xmin
        X_MAX = xmax
        Y_APPROCHE = y
        SEUIL_VALIDATION = seuil
        resetStabilites()
    }

    //% block="régler confiance mini du nombre à %c"
    //% group="Réglages"
    export function reglerConfianceMiniNombre(c: number): void {
        confianceMinNombre = c
    }

    //% block="régler bras/pince | bras haut %bh | bras bas %bb | pince ouverte %po | pince fermée %pf"
    //% group="Réglages"
    export function reglerBrasPince(bh: number, bb: number, po: number, pf: number): void {
        BRAS_HAUT = bh
        BRAS_BAS = bb
        PINCE_OUVERTE = po
        PINCE_FERMEE = pf
    }

    //% block="régler durée | mouvement (ms) %tm | attente (ms) %ta"
    //% group="Réglages"
    export function reglerTemps(tm: number, ta: number): void {
        TEMPS_MOUVEMENT = tm
        TEMPS_ATTENTE = ta
    }

    //% block="régler durée du bras 3 axes à %d ms"
    //% group="Réglages"
    export function reglerDureeBras3Axes(d: number): void {
        BRAS3_DUREE = d
    }

    //% block="initialiser la mission (ne porte rien)"
    //% group="Réglages"
    export function resetMission(): void {
        modeMission = 0
        resetStabilites()
        resetNombres()
    }

    // =========================================================
    // GETTERS
    // =========================================================

    //% block="ID du cube"
    //% group="Réglages"
    export function ID_CUBE_get(): number { return ID_CUBE }

    //% block="Y d'approche"
    //% group="Réglages"
    export function Y_APPROCHE_get(): number { return Y_APPROCHE }

    //% block="seuil de validation"
    //% group="Réglages"
    export function SEUIL_VALIDATION_get(): number { return SEUIL_VALIDATION }

    //% block="confiance mini nombre"
    //% group="Réglages"
    export function confianceMiniNombre_get(): number { return confianceMinNombre }

    // =========================================================
    // CAPTEURS LIGNE
    // =========================================================

    //% block="mettre à jour les capteurs de ligne"
    //% group="Capteurs ligne"
    export function mettreAJourCapteursLigne(): void {
        capteur1 = dadabit.line_followers(dadabit.LineFollowerSensors.S1, dadabit.LineColor.Black)
        capteur2 = dadabit.line_followers(dadabit.LineFollowerSensors.S2, dadabit.LineColor.Black)
        capteur3 = dadabit.line_followers(dadabit.LineFollowerSensors.S3, dadabit.LineColor.Black)
        capteur4 = dadabit.line_followers(dadabit.LineFollowerSensors.S4, dadabit.LineColor.Black)
    }

    //% block="arrivée détectée ? (S1 S2 S3 S4 sur noir)"
    //% group="Capteurs ligne"
    export function arriveeDetectee(): boolean {
        return capteur1 && capteur2 && capteur3 && capteur4
    }

    // =========================================================
    // MOUVEMENTS
    // =========================================================

    //% block="avancer à vitesse %v"
    //% group="Mouvements"
    export function avancer(v: number): void {
        dadabit.setLego360Servo(1, dadabit.Oriention.Counterclockwise, v)
        dadabit.setLego360Servo(2, dadabit.Oriention.Clockwise, v)
        dadabit.setLego360Servo(3, dadabit.Oriention.Counterclockwise, v)
        dadabit.setLego360Servo(4, dadabit.Oriention.Clockwise, v)
    }

    //% block="reculer à vitesse %v"
    //% group="Mouvements"
    export function reculer(v: number): void {
        dadabit.setLego360Servo(1, dadabit.Oriention.Clockwise, v)
        dadabit.setLego360Servo(2, dadabit.Oriention.Counterclockwise, v)
        dadabit.setLego360Servo(3, dadabit.Oriention.Clockwise, v)
        dadabit.setLego360Servo(4, dadabit.Oriention.Counterclockwise, v)
    }

    //% block="arrêter le robot"
    //% group="Mouvements"
    export function arreterRobot(): void {
        dadabit.setLego360Servo(1, dadabit.Oriention.Clockwise, 0)
        dadabit.setLego360Servo(2, dadabit.Oriention.Clockwise, 0)
        dadabit.setLego360Servo(3, dadabit.Oriention.Clockwise, 0)
        dadabit.setLego360Servo(4, dadabit.Oriention.Clockwise, 0)
    }

    //% block="corriger à gauche (vitesse %v)"
    //% group="Mouvements"
    export function corrigerAGauche(v: number): void {
        dadabit.setLego360Servo(1, dadabit.Oriention.Clockwise, v)
        dadabit.setLego360Servo(2, dadabit.Oriention.Clockwise, v)
        dadabit.setLego360Servo(3, dadabit.Oriention.Clockwise, v)
        dadabit.setLego360Servo(4, dadabit.Oriention.Clockwise, v)
    }

    //% block="corriger à droite (vitesse %v)"
    //% group="Mouvements"
    export function corrigerADroite(v: number): void {
        dadabit.setLego360Servo(1, dadabit.Oriention.Counterclockwise, v)
        dadabit.setLego360Servo(2, dadabit.Oriention.Counterclockwise, v)
        dadabit.setLego360Servo(3, dadabit.Oriention.Counterclockwise, v)
        dadabit.setLego360Servo(4, dadabit.Oriention.Counterclockwise, v)
    }

    // =========================================================
    // SUIVI DE LIGNE
    // =========================================================

    //% block="suivre la ligne"
    //% group="Suivi de ligne"
    export function suiviDeLigne(): void {
        if (capteur2 && capteur3) {
            avancer(vitesseToutDroit)
        } else if (capteur1 && capteur2 && (!capteur3 && !capteur4)) {
            corrigerAGauche(vitesseCorrection)
        } else if (capteur3 && capteur4 && (!capteur1 && !capteur2)) {
            corrigerADroite(vitesseCorrection)
        } else if (capteur2 && !capteur1 && (!capteur3 && !capteur4)) {
            dadabit.setLego360Servo(1, dadabit.Oriention.Counterclockwise, vitesseCorrection)
            dadabit.setLego360Servo(2, dadabit.Oriention.Clockwise, petiteVitesse)
            dadabit.setLego360Servo(3, dadabit.Oriention.Counterclockwise, vitesseCorrection)
            dadabit.setLego360Servo(4, dadabit.Oriention.Clockwise, petiteVitesse)
        } else if (capteur3 && !capteur1 && (!capteur2 && !capteur4)) {
            dadabit.setLego360Servo(1, dadabit.Oriention.Counterclockwise, petiteVitesse)
            dadabit.setLego360Servo(2, dadabit.Oriention.Clockwise, vitesseCorrection)
            dadabit.setLego360Servo(3, dadabit.Oriention.Counterclockwise, petiteVitesse)
            dadabit.setLego360Servo(4, dadabit.Oriention.Clockwise, vitesseCorrection)
        } else if (capteur1 && !capteur2 && (!capteur3 && !capteur4)) {
            corrigerAGauche(vitesseToutDroit)
        } else if (capteur4 && !capteur1 && (!capteur2 && !capteur3)) {
            corrigerADroite(vitesseToutDroit)
        } else {
            avancer(petiteVitesse)
        }
    }

    // =========================================================
    // VISION (couleur)
    // =========================================================

    //% block="mettre à jour la caméra"
    //% group="Vision (couleur)"
    export function mettreAJourCamera(): void {
        wondercam.UpdateResult()
    }

    //% block="couleur ID %id détectée ?"
    //% group="Vision (couleur)"
    export function cubeDetecte(id: number): boolean {
        return wondercam.isDetectedColorId(id)
    }

    //% block="position Y de la couleur ID %id"
    //% group="Vision (couleur)"
    export function yCube(id: number): number {
        return wondercam.XOfColorId(wondercam.Options.Pos_Y, id)
    }

    //% block="afficher la couleur LED pour ID %id"
    //% group="Vision (couleur)"
    export function afficherCouleurDetectee(id: number): void {
        if (id == 1) {
            dadabit.setBoardPixelRGB(dadabit.Lights.All, RGBColors.Red)
        } else if (id == 2) {
            dadabit.setBoardPixelRGB(dadabit.Lights.All, RGBColors.Green)
        } else if (id == 3) {
            dadabit.setBoardPixelRGB(dadabit.Lights.All, RGBColors.Blue)
        } else if (id == 4) {
            dadabit.setBoardPixelRGB(dadabit.Lights.All, RGBColors.Yellow)
        }
        dadabit.showBoardLight()
    }

    //% block="éteindre les LEDs"
    //% group="Vision (couleur)"
    export function eteindreLEDs(): void {
        dadabit.clearBoardLight()
    }

    //% block="rouge stable ? seuil %seuil"
    //% group="Vision (couleur)"
    export function rougeStable(seuil: number): boolean {
        return detectionStableId(1, seuil)
    }

    //% block="vert stable ? seuil %seuil"
    //% group="Vision (couleur)"
    export function vertStable(seuil: number): boolean {
        return detectionStableId(2, seuil)
    }

    //% block="bleu stable ? seuil %seuil"
    //% group="Vision (couleur)"
    export function bleuStable(seuil: number): boolean {
        return detectionStableId(3, seuil)
    }

    //% block="jaune stable ? seuil %seuil"
    //% group="Vision (couleur)"
    export function jauneStable(seuil: number): boolean {
        return detectionStableId(4, seuil)
    }

    //% block="approcher le cube rouge"
    //% group="Vision (couleur)"
    export function approcherRouge(): void {
        approcherId(1)
    }

    //% block="approcher le cube vert"
    //% group="Vision (couleur)"
    export function approcherVert(): void {
        approcherId(2)
    }

    //% block="approcher le cube bleu"
    //% group="Vision (couleur)"
    export function approcherBleu(): void {
        approcherId(3)
    }

    //% block="approcher le cube jaune"
    //% group="Vision (couleur)"
    export function approcherJaune(): void {
        approcherId(4)
    }

    //% block="cube détecté de façon stable ?"
    //% group="Vision (couleur)"
    export function cubeDetecteStable(): boolean {
        return detectionStableId(ID_CUBE, SEUIL_VALIDATION)
    }

    //% block="approcher le cube (jusqu'à Y d'approche)"
    //% group="Vision (couleur)"
    export function approcherCube(): void {
        approcherId(ID_CUBE)
    }

    // =========================================================
    // VISION (chiffres)
    // =========================================================

    //% block="nombre reconnu"
    //% group="Vision (chiffres)"
    export function nombreReconnu(): number {
        return wondercam.NumberWithMaxConfidence()
    }

    //% block="confiance du nombre"
    //% group="Vision (chiffres)"
    export function confianceNombre(): number {
        return wondercam.MaxConfidenceOfNumber()
    }

    //% block="nombre %n détecté ?"
    //% group="Vision (chiffres)"
    export function nombreDetecte(n: number): boolean {
        return confianceNombre() >= confianceMinNombre && nombreReconnu() == n
    }

    //% block="nombre %n détecté de façon stable ? seuil %seuil"
    //% group="Vision (chiffres)"
    export function nombreStable(n: number, seuil: number): boolean {
        return nombreValideEtStableInterne(n, seuil)
    }

    //% block="attendre le nombre %n stable seuil %seuil"
    //% group="Vision (chiffres)"
    export function attendreNombreStable(n: number, seuil: number): void {
        resetNombres()
        while (true) {
            mettreAJourCamera()
            if (nombreValideEtStableInterne(n, seuil)) {
                break
            }
            basic.pause(50)
        }
    }

    //% block="attendre le chiffre 1 ou 2 stable seuil %seuil"
    //% group="Vision (chiffres)"
    export function attendreUnOuDeuxStable(seuil: number): number {
        resetNombres()
        while (true) {
            mettreAJourCamera()

            if (confianceNombre() >= confianceMinNombre) {
                let n = nombreReconnu()

                if (n == 1 || n == 2) {
                    if (n == dernierNombre) {
                        compteurNombreStable += 1
                    } else {
                        dernierNombre = n
                        compteurNombreStable = 1
                    }

                    if (compteurNombreStable >= seuil) {
                        let resultat = n
                        resetNombres()
                        return resultat
                    }
                } else {
                    resetNombres()
                }
            } else {
                resetNombres()
            }

            basic.pause(50)
        }
        return 0
    }

    // =========================================================
    // BRAS & PINCE
    // =========================================================

    //% block="bras en haut"
    //% group="Bras & Pince"
    export function brasEnHaut(): void {
        dadabit.setLego270Servo(5, BRAS_HAUT, TEMPS_MOUVEMENT)
    }

    //% block="bras en bas"
    //% group="Bras & Pince"
    export function brasEnBas(): void {
        dadabit.setLego270Servo(5, BRAS_BAS, TEMPS_MOUVEMENT)
    }

    //% block="ouvrir la pince"
    //% group="Bras & Pince"
    export function ouvrirPince(): void {
        dadabit.setLego270Servo(6, PINCE_OUVERTE, TEMPS_MOUVEMENT)
    }

    //% block="fermer la pince"
    //% group="Bras & Pince"
    export function fermerPince(): void {
        dadabit.setLego270Servo(6, PINCE_FERMEE, TEMPS_MOUVEMENT)
    }

    //% block="bras au repos (bras haut + pince ouverte)"
    //% group="Bras & Pince"
    export function brasAuRepos(): void {
        brasEnHaut()
        basic.pause(300)
        ouvrirPince()
        basic.pause(300)
    }

    //% block="attraper le cube"
    //% group="Bras & Pince"
    export function attraperCube(): void {
        arreterRobot()
        basic.pause(500)
        brasEnBas()
        basic.pause(TEMPS_ATTENTE)
        fermerPince()
        basic.pause(TEMPS_ATTENTE)
        brasEnHaut()
        basic.pause(TEMPS_ATTENTE)
        modeMission = 1
    }

    //% block="déposer le cube"
    //% group="Bras & Pince"
    export function deposerCube(): void {
        brasEnBas()
        basic.pause(TEMPS_ATTENTE)
        ouvrirPince()
        basic.pause(TEMPS_ATTENTE)
        brasEnHaut()
        basic.pause(TEMPS_ATTENTE)
        modeMission = 0
    }

    //% block="servo 1 angle %a1 | servo 2 angle %a2 | servo 3 angle %a3"
    //% group="Bras & Pince"
    export function allerPositionBras3Axes(a1: number, a2: number, a3: number): void {
        dadabit.setLego270Servo(1, a1, BRAS3_DUREE)
        basic.pause(1000)
        dadabit.setLego270Servo(2, a2, BRAS3_DUREE)
        basic.pause(1000)
        dadabit.setLego270Servo(3, a3, BRAS3_DUREE)
        basic.pause(1000)
    }

    //% block="aller à la position 1"
    //% group="Bras & Pince"
    export function position1Bras3Axes(): void {
        allerPositionBras3Axes(0, 90, -135)
    }

    //% block="aller à la position 2"
    //% group="Bras & Pince"
    export function position2Bras3Axes(): void {
        allerPositionBras3Axes(-45, 90, -135)
    }

    //% block="aller à la position 3"
    //% group="Bras & Pince"
    export function position3Bras3Axes(): void {
        allerPositionBras3Axes(-135, 90, -135)
    }

    //% block="aller à la position 4"
    //% group="Bras & Pince"
    export function position4Bras3Axes(): void {
        allerPositionBras3Axes(45, 90, -135)
    }

    //% block="revenir à la position initiale du bras"
    //% group="Bras & Pince"
    export function retourPositionInitialeBras3Axes(): void {
        dadabit.setLego270Servo(2, 45, BRAS3_DUREE)
        basic.pause(1000)
        dadabit.setLego270Servo(1, -90, BRAS3_DUREE)
        basic.pause(1400)
        dadabit.setLego270Servo(3, -135, BRAS3_DUREE)
        basic.pause(1000)
        basic.clearScreen()
    }

    //% block="saisir la pièce avec le bras"
    //% group="Bras & Pince"
    export function saisirPieceBras3Axes(): void {
        dadabit.setLego270Servo(2, 110, BRAS3_DUREE)
        basic.pause(1000)
        dadabit.setLego270Servo(3, -70, BRAS3_DUREE)
        basic.pause(1000)
        dadabit.setLego270Servo(2, 45, BRAS3_DUREE)
        basic.pause(1000)
    }

    // =========================================================
    // MISSION
    // =========================================================

    //% block="ne porte pas de cube ?"
    //% group="Mission"
    export function nePortePasCube(): boolean {
        return modeMission == 0
    }

    //% block="bip (signal sonore)"
    //% group="Mission"
    export function jouerBip(): void {
        music.play(music.tonePlayable(262, music.beat(BeatFraction.Whole)), music.PlaybackMode.UntilDone)
    }

    //% block="gérer la destination (stop, déposer si besoin, demi-tour)"
    //% group="Mission"
    export function destination(): void {
        arreterRobot()
        basic.pause(500)

        if (modeMission == 1) {
            deposerCube()
        }

        mettreAJourCapteursLigne()

        dadabit.setLego360Servo(1, dadabit.Oriention.Clockwise, vitesseCorrection)
        dadabit.setLego360Servo(2, dadabit.Oriention.Counterclockwise, vitesseCorrection)
        dadabit.setLego360Servo(3, dadabit.Oriention.Clockwise, vitesseCorrection)
        dadabit.setLego360Servo(4, dadabit.Oriention.Counterclockwise, vitesseCorrection)
        basic.pause(500)

        while (capteur1 || capteur2 || !(capteur3 && capteur4)) {
            corrigerADroite(vitesseCorrection)
            mettreAJourCapteursLigne()
        }
    }

    //% block="cycle mission (1 étape)"
    //% group="Mission"
    export function cycleMission(): void {
        mettreAJourCamera()
        mettreAJourCapteursLigne()

        if (modeMission == 0 && cubeDetecteStable()) {
            jouerBip()
            approcherCube()
            attraperCube()
        }

        if (arriveeDetectee()) {
            destination()
        } else {
            suiviDeLigne()
        }
    }

    //% block="traiter le cube rouge"
    //% group="Mission"
    export function traiterCubeRouge(): void {
        jouerBip()
        basic.pause(200)
        afficherCouleurDetectee(1)
        basic.pause(1000)
        saisirPieceBras3Axes()
        position1Bras3Axes()
        retourPositionInitialeBras3Axes()
        eteindreLEDs()
    }

    //% block="traiter le cube vert"
    //% group="Mission"
    export function traiterCubeVert(): void {
        jouerBip()
        basic.pause(200)
        afficherCouleurDetectee(2)
        basic.pause(1000)
        saisirPieceBras3Axes()
        position2Bras3Axes()
        retourPositionInitialeBras3Axes()
        eteindreLEDs()
    }

    //% block="traiter le cube bleu"
    //% group="Mission"
    export function traiterCubeBleu(): void {
        jouerBip()
        basic.pause(200)
        afficherCouleurDetectee(3)
        basic.pause(1000)
        saisirPieceBras3Axes()
        position3Bras3Axes()
        retourPositionInitialeBras3Axes()
        eteindreLEDs()
    }

    //% block="traiter le cube jaune"
    //% group="Mission"
    export function traiterCubeJaune(): void {
        jouerBip()
        basic.pause(200)
        afficherCouleurDetectee(4)
        basic.pause(1000)
        saisirPieceBras3Axes()
        position4Bras3Axes()
        retourPositionInitialeBras3Axes()
        eteindreLEDs()
    }
}
