import logging
from app.config import EUREKA_ENABLED, EUREKA_SERVER, APP_NAME, PORT

logger = logging.getLogger("smartcampus.eureka")

def init_eureka():
    if not EUREKA_ENABLED:
        logger.info("[EUREKA] Enregistrement Eureka désactivé en mode local (EUREKA_ENABLED=false).")
        return

    try:
        import py_eureka_client.eureka_client as eureka_client
        eureka_client.init(
            eureka_server=EUREKA_SERVER,
            app_name=APP_NAME,
            instance_port=PORT,
            instance_host="localhost",
            status_page_url=f"http://localhost:{PORT}/docs",
            health_check_url=f"http://localhost:{PORT}/health"
        )
        logger.info(f"[EUREKA] Enregistré avec succès sur {EUREKA_SERVER} en tant que {APP_NAME}:{PORT}")
    except Exception as e:
        logger.warning(f"[EUREKA] Impossible de joindre le serveur Eureka ({e}) - Démarrage poursuivi en mode autonome.")

def stop_eureka():
    if not EUREKA_ENABLED:
        return
    try:
        import py_eureka_client.eureka_client as eureka_client
        eureka_client.stop()
        logger.info("[EUREKA] Désinscription Eureka effectuée.")
    except Exception as e:
        logger.warning(f"[EUREKA] Erreur lors de la désinscription: {e}")
