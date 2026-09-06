(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationIdentity = factory();
})(globalThis, function () {
  'use strict';

  const DEFAULT_MASKS = Object.freeze({
    trueName: { label: null, role: null, tags: ['真实身份'], strength: 100, cover: '真实身份' },
    anonymous: { label: '无名散修', role: '散修', tags: ['匿名', '可交易'], strength: 58, cover: '不愿留下姓名的散修' },
    merchant: { label: '行商客卿', role: '商路客卿', tags: ['商路', '可议价'], strength: 42, cover: '以货物和情报换取通行权的客卿' },
    sect: { label: '外门弟子', role: '宗门外门弟子', tags: ['宗门', '受约束'], strength: 34, cover: '持有一份不完整宗门凭证的外来弟子' }
  });

  function ensure(entity, knowledge) {
    if (!entity) return null;
    const data = knowledge.ensure(entity);
    data.masks.trueName ||= { ...DEFAULT_MASKS.trueName, label: entity.identity?.name || entity.id, role: entity.identity?.role || '居民', tags: [...(entity.identity?.tags || []), '真实身份'], revealedTo: [] };
    for (const [id, seed] of Object.entries(DEFAULT_MASKS)) {
      if (id === 'trueName') continue;
      data.masks[id] ||= { ...seed, tags: [...seed.tags], revealedTo: [] };
    }
    data.activeMask ||= 'trueName';
    if (!data.masks[data.activeMask]) data.activeMask = 'trueName';
    return data;
  }

  function current(entity, knowledge) {
    const data = ensure(entity, knowledge);
    return data?.masks?.[data.activeMask] || data?.masks?.trueName || null;
  }

  function wear(entity, maskId, clock, knowledge) {
    const data = ensure(entity, knowledge);
    const mask = data.masks[maskId];
    if (!mask) throw new Error(`未知身份面具：${maskId}`);
    data.activeMask = maskId;
    mask.lastWorn = clock;
    mask.wornCount = (mask.wornCount || 0) + 1;
    return mask;
  }

  function reveal(subject, observer, clock, knowledge, reason = '主动摊牌') {
    const data = ensure(subject, knowledge);
    const mask = current(subject, knowledge);
    if (!observer || !mask) return null;
    mask.revealedTo ||= [];
    if (!mask.revealedTo.includes(observer.id)) mask.revealedTo.push(observer.id);
    mask.revealedTo = mask.revealedTo.slice(-32);
    knowledge.record(observer, subject.id, {
      identityKnown: true,
      trueName: subject.identity?.name || subject.id,
      revealedMask: data.activeMask
    }, { kind: 'secret', clock, source: `identity:${reason}`, confidence: 0.98 });
    return mask;
  }

  function visible(subject, observerId, knowledge) {
    if (!subject) return { name: '未知', role: '未知', tags: [] };
    const data = ensure(subject, knowledge);
    const mask = current(subject, knowledge);
    if (!mask || data.activeMask === 'trueName' || mask.revealedTo?.includes(observerId)) {
      return { name: subject.identity.name, role: subject.identity.role, tags: [...(subject.identity.tags || [])], maskId: 'trueName', masked: false };
    }
    return { name: mask.label, role: mask.role, tags: [...mask.tags], maskId: data.activeMask, masked: true };
  }

  function exposeTrace(subject, observer, clock, knowledge, reason = '交易痕迹') {
    const data = ensure(subject, knowledge);
    const mask = current(subject, knowledge);
    if (!mask || data.activeMask === 'trueName' || !observer) return false;
    knowledge.record(observer, subject.id, { observedMask: data.activeMask, publicLabel: mask.label }, { kind: 'suspicion', clock, source: `identity:${reason}`, confidence: 0.64 });
    knowledge.raiseSuspicion(observer, subject.id, 5, { clock, reason });
    return true;
  }

  return { DEFAULT_MASKS, ensure, current, wear, reveal, visible, exposeTrace };
});
