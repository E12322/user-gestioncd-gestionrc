import { toast } from "sonner";

/**
 * Événement de domaine publié par un microservice (bus Kafka/RabbitMQ en production).
 * En démo : trace console + toast. Utilisable par tous les modules.
 */
export function publishDomainEvent(service: string, name: string, description: string) {
  console.info(`[${service}] événement publié : ${name}`, description);
  toast.success(`Événement publié : ${name}`, { description });
}
