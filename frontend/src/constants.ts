export const SEQ_TYPES = [
  "3'转录组测序",
  "3'转录组测序（抽核）",
  "5'转录组测序",
  "5'转录组+BCR测序",
  "5'转录组+TCR测序",
  "5'转录组+BCR+TCR测序",
  "单BCR测序",
  "单TCR测序",
  "BCR/TCR共测序",
  "snATAC测序",
  "3'转录组测序+表面蛋白",
  "5'转录组测序+crispr"
] as const;

export const PLATFORMS = ['寻因', '10x'] as const;

export interface StatusOption {
  value: string;
  label: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  { value: 'pending', label: '待完成' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' }
];

export const NEED_DISSOCIATION_OPTIONS = [
  { value: true, label: '是' },
  { value: false, label: '否' }
] as const;
