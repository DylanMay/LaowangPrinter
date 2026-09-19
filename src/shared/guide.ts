import { COPY } from './copy'

export const GUIDE_STORAGE_KEY = 'laowang.guideCompleted'

export const GUIDE_STEPS = [
  { title: COPY.guideConnectTitle, body: COPY.guideConnectBody },
  { title: COPY.guideConfirmTitle, body: COPY.guideConfirmBody },
  { title: COPY.guideMoveTitle, body: COPY.guideMoveBody },
  { title: COPY.guidePlaceTitle, body: COPY.guidePlaceBody },
  { title: COPY.guideStartTitle, body: COPY.guideStartBody },
] as const
