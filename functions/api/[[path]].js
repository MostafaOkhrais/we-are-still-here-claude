// API router for /api/*  (Cloudflare Pages Function, backed by D1 at env.DB).
import { json, HttpError } from '../_lib/util.js';
import * as pub from '../_lib/public.js';
import * as adm from '../_lib/admin.js';

const ID = '([0-9]+)';

// [method, path pattern, handler]
const ROUTES = [
  ['POST', /^contact$/, pub.contact],
  ['POST', /^newsletter$/, pub.subscribe],
  ['GET', /^newsletter\/confirm$/, pub.confirm],
  ['GET', /^newsletter\/unsubscribe$/, pub.unsubscribe],
  ['POST', /^newsletter\/unsubscribe$/, pub.unsubscribe],
  ['GET', /^news$/, pub.news],
  ['HEAD', /^news$/, pub.news],

  ['POST', /^admin\/login$/, adm.login],
  ['POST', /^admin\/logout$/, adm.logout],
  ['GET', /^admin\/me$/, adm.me],
  ['GET', /^admin\/stats$/, adm.stats],
  ['GET', /^admin\/messages$/, adm.listMessages],
  ['PATCH', new RegExp('^admin/messages/' + ID + '$'), adm.updateMessage],
  ['DELETE', new RegExp('^admin/messages/' + ID + '$'), adm.deleteMessage],
  ['GET', /^admin\/subscribers$/, adm.listSubscribers],
  ['PATCH', new RegExp('^admin/subscribers/' + ID + '$'), adm.updateSubscriber],
  ['DELETE', new RegExp('^admin/subscribers/' + ID + '$'), adm.deleteSubscriber],
  ['GET', /^admin\/posts$/, adm.listPosts],
  ['POST', /^admin\/posts$/, adm.createPost],
  ['PATCH', new RegExp('^admin/posts/' + ID + '$'), adm.updatePost],
  ['DELETE', new RegExp('^admin/posts/' + ID + '$'), adm.deletePost],
  ['GET', /^admin\/campaigns$/, adm.listCampaigns],
  ['POST', /^admin\/campaigns$/, adm.sendCampaign],
];

export async function onRequest(context) {
  const { request, env, params } = context;
  try {
    if (!env.DB) return json(500, { error: 'server_error' });
    const parts = Array.isArray(params.path) ? params.path : [params.path || ''];
    const route = parts.join('/').replace(/\/+$/, '');
    const method = request.method.toUpperCase();

    let pathMatched = false;
    for (const [m, re, handler] of ROUTES) {
      const match = re.exec(route);
      if (!match) continue;
      pathMatched = true;
      if (m !== method) continue;
      return await handler(context, match[1]);
    }
    return json(pathMatched ? 405 : 404, { error: pathMatched ? 'method_not_allowed' : 'not_found' });
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.code });
    console.error('api error:', err && err.message ? err.message : err);
    return json(500, { error: 'server_error' });
  }
}
