import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { cmsService } from '../services/cms.js';

interface CMSPageQuery {
  pageLabelOrId: string;
  lang?: string;
  curr?: string;
}

interface CMSComponentsQuery {
  componentIds: string;
  lang?: string;
  curr?: string;
}

interface CMSTranslationParams {
  lang: string;
  namespace: string;
}

export async function registerCMSRoutes(fastify: FastifyInstance) {
  // Get CMS Page
  fastify.get('/cms/pages', async (
    request: FastifyRequest<{ Querystring: CMSPageQuery }>,
    reply: FastifyReply
  ) => {
    try {
      const { pageLabelOrId, lang = 'en', curr = 'EUR' } = request.query;

      if (!pageLabelOrId) {
        return reply.code(400).send({
          error: 'Missing required parameter: pageLabelOrId',
        });
      }

      const page = await cmsService.getPage(pageLabelOrId, lang, curr);
      return reply.send(page);
    } catch (error: any) {
      request.log.error('Error fetching CMS page:', error);
      return reply.code(error.response?.status || 500).send({
        error: error.message || 'Failed to fetch CMS page',
      });
    }
  });

  // Get CMS Components
  fastify.get('/cms/components', async (
    request: FastifyRequest<{ Querystring: CMSComponentsQuery }>,
    reply: FastifyReply
  ) => {
    try {
      const { componentIds, lang = 'en', curr = 'EUR' } = request.query;

      if (!componentIds) {
        return reply.code(400).send({
          error: 'Missing required parameter: componentIds',
        });
      }

      const ids = componentIds.split(',');
      const components = await cmsService.getComponents(ids, lang, curr);
      return reply.send(components);
    } catch (error: any) {
      request.log.error('Error fetching CMS components:', error);
      return reply.code(error.response?.status || 500).send({
        error: error.message || 'Failed to fetch CMS components',
      });
    }
  });

  // Get Languages
  fastify.get('/cms/languages', async (
    request: FastifyRequest<{ Querystring: { lang?: string; curr?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { lang = 'en', curr = 'EUR' } = request.query;
      const languages = await cmsService.getLanguages(lang, curr);
      return reply.send(languages);
    } catch (error: any) {
      request.log.error('Error fetching languages:', error);
      return reply.code(error.response?.status || 500).send({
        error: error.message || 'Failed to fetch languages',
      });
    }
  });

  // Get Translation
  fastify.get('/cms/translation/:lang/:namespace', async (
    request: FastifyRequest<{ Params: CMSTranslationParams }>,
    reply: FastifyReply
  ) => {
    try {
      const { lang, namespace } = request.params;
      const translation = await cmsService.getTranslation(lang, namespace);
      return reply.send(translation);
    } catch (error: any) {
      request.log.error('Error fetching translation:', error);
      return reply.code(error.response?.status || 500).send({
        error: error.message || 'Failed to fetch translation',
      });
    }
  });

  // Get CDC Config
  fastify.get('/cms/config/cdc', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const config = await cmsService.getCDCConfig();
      return reply.send(config);
    } catch (error: any) {
      request.log.error('Error fetching CDC config:', error);
      return reply.code(error.response?.status || 500).send({
        error: error.message || 'Failed to fetch CDC config',
      });
    }
  });

  // Get Analytics Config
  fastify.get('/cms/config/analytics', async (
    request: FastifyRequest<{ Querystring: { lang?: string; curr?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { lang = 'en', curr = 'USD' } = request.query;
      const config = await cmsService.getAnalyticsConfig(lang, curr);
      return reply.send(config);
    } catch (error: any) {
      request.log.error('Error fetching analytics config:', error);
      return reply.code(error.response?.status || 500).send({
        error: error.message || 'Failed to fetch analytics config',
      });
    }
  });
}
