import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { RevenuePage } from '../pages/RevenuePage';
vi.mock('../assets', () => ({ AssetMapList: ({map}: {map:Record<string,string>}) => JSON.stringify(map) }));
const empty = {
 fills:6, transactions:6, activeTraders:2, kinds:{limit:6}, bchSideVolumeSats:'915631',
 treasury:{'0x':'8513'},retained:{},partners:{},recordedFillFeeSats:'12283',
 comparable:{fills:5,receiptsSats:'8513',feeSats:'9680',marginSats:'-1167'},
 coverage:{unknownReceiptFills:0,missingFeeFills:0,inventoryFills:0,unknownTimestampFills:0},
 balancer:{confirmedTrades:14,confirmedNetSats:'932628',pendingTrades:9,pendingNetSats:'130145',rejected:1,dryRun:0}
};
vi.mock('../hooks', () => ({ useRevenue: () => ({
 isLoading:false,error:null,refetch:vi.fn(),data:{
  network:'chipnet',treasuryPkh:'public-pkh',solverAddress:'public-solver',balancerAddress:'public-bot',
  balancerOnline:true,balancerDryRun:false,retainedBalancerTrades:74,
  windows:{h24:empty,d7:empty,d30:empty,all:empty}
 }
}) }));
describe('revenue admin page',()=>{
 it('renders actual recorded receipts and separates confirmed and pending gains',()=>{
  const html=renderToStaticMarkup(createElement(MemoryRouter,null,createElement(RevenuePage)));
  expect(html).toContain('Revenue &amp; execution costs');
  expect(html).toContain('8513');
  expect(html).toContain('Confirmed net gain');
  expect(html).toContain('Pending net gain');
 });
 it('makes incomplete accounting visible instead of calling it operating profit',()=>{
  const html=renderToStaticMarkup(createElement(MemoryRouter,null,createElement(RevenuePage)));
  expect(html).toContain('not total operating profit');
  expect(html).toContain('Token quantities are never added to BCH');
  expect(html).toContain('Proposed volume fees and subscriptions are not counted');
 });
});
