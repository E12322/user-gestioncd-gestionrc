import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Vue minimale d'une chambre du service Chambres (cote client HTTP). */
export interface ChambreView {
  id: string;
  numero: string;
  type: 'SIMPLE' | 'DOUBLE' | 'STUDIO';
  capacite: number;
  disponible: boolean;
  batiment: string;
  etage: number;
}

/**
 * Client HTTP vers le microservice Chambres.
 * Remplace l'injection directe de ChambresService depuis l'extraction en
 * microservices : occuper/liberer/voir une chambre passent par le reseau.
 */
@Injectable()
export class ChambresHttpClient {
  private readonly logger = new Logger(ChambresHttpClient.name);

  constructor(private readonly config: ConfigService) {}

  private get base(): string {
    return this.config.get<string>('CHAMBRES_URL') ?? 'http://localhost:3011';
  }

  async findOne(id: string): Promise<ChambreView> {
    return this.request<ChambreView>(`/api/chambres/${id}`, 'GET');
  }

  async occuper(id: string): Promise<ChambreView> {
    return this.request<ChambreView>(`/api/chambres/${id}/occuper`, 'POST');
  }

  async liberer(id: string): Promise<ChambreView> {
    return this.request<ChambreView>(`/api/chambres/${id}/liberer`, 'POST');
  }

  private async request<T>(path: string, method: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        method,
        headers: { Accept: 'application/json' },
      });
    } catch (error) {
      this.logger.error(`Service Chambres injoignable (${path}) : ${error}`);
      throw new ServiceUnavailableException(
        'Service Chambres momentanement indisponible',
      );
    }

    if (!res.ok) {
      const details = (await res.json().catch(() => undefined)) as
        | {
            message?: string | string[];
          }
        | undefined;
      const raw = details?.message;
      const message = Array.isArray(raw) ? raw.join(', ') : raw;
      throw new HttpException(
        message ?? `Erreur du service Chambres (${res.status})`,
        res.status,
      );
    }

    return (await res.json()) as T;
  }
}
