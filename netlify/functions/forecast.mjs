import {getStore} from '@netlify/blobs';
import {createForecastHandler} from './lib/forecast.mjs';
export default createForecastHandler({getStore:()=>getStore({name:'pantau-forecasts',consistency:'strong'})});
export const config={path:'/api/forecast',rateLimit:{windowLimit:120,windowSize:60,aggregateBy:['ip','domain']}};
