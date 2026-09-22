// ══════════════════════════════════
// EXPENSE DATA
// ══════════════════════════════════
const INIT_EXPENSES = [
  {id:1,person:'shower',personName:'李鎮宇',month:'2025-12',caseKey:'YT-UPY-2026-001',caseName:'上洋高雄',date:'2025-12-01',item:'月度費用申請（匯總）',amount:30,category:'停車',receipt:'無',status:'approved',note:''},
  {id:2,person:'shower',personName:'李鎮宇',month:'2025-12',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-12-01',item:'月度費用申請（匯總）',amount:3666,category:'停車',receipt:'無',status:'approved',note:''},
  {id:3,person:'shower',personName:'李鎮宇',month:'2025-12',caseKey:'YT-KYG-2025-001',caseName:'同協路凱揚',date:'2025-12-01',item:'月度費用申請（匯總）',amount:20,category:'停車',receipt:'無',status:'approved',note:'凱揚汽車'},
  {id:4,person:'shower',personName:'李鎮宇',month:'2025-12',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-12-01',item:'月度費用申請（匯總）',amount:675,category:'停車',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:5,person:'shower',personName:'李鎮宇',month:'2025-12',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-12-01',item:'月度費用申請（匯總）',amount:5962,category:'加油',receipt:'無',status:'approved',note:''},
  {id:6,person:'shower',personName:'李鎮宇',month:'2025-12',caseKey:'YT-KYG-2025-001',caseName:'同協路凱揚',date:'2025-12-01',item:'月度費用申請（匯總）',amount:831,category:'加油',receipt:'無',status:'approved',note:'凱揚汽車'},
  {id:7,person:'shower',personName:'李鎮宇',month:'2025-12',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-12-01',item:'月度費用申請（匯總）',amount:1154,category:'加油',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:8,person:'shower',personName:'李鎮宇',month:'2025-12',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-12-01',item:'月度費用申請（匯總）',amount:22500,category:'工程',receipt:'無',status:'approved',note:''},
  {id:9,person:'shower',personName:'李鎮宇',month:'2025-12',caseKey:'YT-SUZ-2025-002',caseName:'民族 Suzuki',date:'2025-12-01',item:'月度費用申請（匯總）',amount:1550,category:'電話網路/訂閱費',receipt:'無',status:'approved',note:'民族服務'},
  {id:10,person:'shower',personName:'李鎮宇',month:'2025-11',caseKey:'YT-UPY-2026-001',caseName:'上洋高雄',date:'2025-11-01',item:'月度費用申請（匯總）',amount:6754,category:'交際費',receipt:'無',status:'approved',note:''},
  {id:11,person:'shower',personName:'李鎮宇',month:'2025-11',caseKey:'YT-KYG-2025-001',caseName:'同協路凱揚',date:'2025-11-01',item:'月度費用申請（匯總）',amount:525,category:'停車',receipt:'無',status:'approved',note:'凱揚汽車'},
  {id:12,person:'shower',personName:'李鎮宇',month:'2025-11',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-11-01',item:'月度費用申請（匯總）',amount:240,category:'停車',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:13,person:'shower',personName:'李鎮宇',month:'2025-11',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-11-01',item:'月度費用申請（匯總）',amount:1260,category:'其他',receipt:'無',status:'approved',note:''},
  {id:14,person:'shower',personName:'李鎮宇',month:'2025-11',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-11-01',item:'月度費用申請（匯總）',amount:822,category:'加油',receipt:'無',status:'approved',note:''},
  {id:15,person:'shower',personName:'李鎮宇',month:'2025-11',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-11-01',item:'月度費用申請（匯總）',amount:1548,category:'加油',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:16,person:'shower',personName:'李鎮宇',month:'2025-11',caseKey:'YT-VOL-2025-001',caseName:'林口三井',date:'2025-11-01',item:'月度費用申請（匯總）',amount:4581,category:'加油',receipt:'無',status:'approved',note:''},
  {id:17,person:'shower',personName:'李鎮宇',month:'2025-11',caseKey:'YT-KYG-2025-001',caseName:'同協路凱揚',date:'2025-11-01',item:'月度費用申請（匯總）',amount:1100,category:'工程',receipt:'無',status:'approved',note:'凱揚汽車'},
  {id:18,person:'shower',personName:'李鎮宇',month:'2025-11',caseKey:'YT-VOL-2025-001',caseName:'林口三井',date:'2025-11-01',item:'月度費用申請（匯總）',amount:250,category:'工程',receipt:'無',status:'approved',note:''},
  {id:19,person:'shower',personName:'李鎮宇',month:'2025-11',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-11-01',item:'月度費用申請（匯總）',amount:1478,category:'辦公用品',receipt:'無',status:'approved',note:''},
  {id:20,person:'shower',personName:'李鎮宇',month:'2025-11',caseKey:'YT-KYG-2025-001',caseName:'同協路凱揚',date:'2025-11-01',item:'月度費用申請（匯總）',amount:369,category:'辦公用品',receipt:'無',status:'approved',note:'凱揚汽車'},
  {id:21,person:'shower',personName:'李鎮宇',month:'2025-11',caseKey:'YT-KYG-2025-001',caseName:'同協路凱揚',date:'2025-11-01',item:'月度費用申請（匯總）',amount:236,category:'郵資',receipt:'無',status:'approved',note:'凱揚汽車'},
  {id:22,person:'shower',personName:'李鎮宇',month:'2025-11',caseKey:'固定開銷',caseName:'固定開銷',date:'2025-11-01',item:'月度費用申請（匯總）',amount:2593,category:'電話網路/訂閱費',receipt:'無',status:'approved',note:''},
  {id:23,person:'shower',personName:'李鎮宇',month:'2025-10',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-10-01',item:'月度費用申請（匯總）',amount:4640,category:'交通費',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:24,person:'shower',personName:'李鎮宇',month:'2025-10',caseKey:'YT-VOL-2025-001',caseName:'林口三井',date:'2025-10-01',item:'月度費用申請（匯總）',amount:30,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:25,person:'shower',personName:'李鎮宇',month:'2025-10',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-10-01',item:'月度費用申請（匯總）',amount:500,category:'停車',receipt:'無',status:'approved',note:''},
  {id:26,person:'shower',personName:'李鎮宇',month:'2025-10',caseKey:'YT-VOL-2025-001',caseName:'林口三井',date:'2025-10-01',item:'月度費用申請（匯總）',amount:135,category:'停車',receipt:'無',status:'approved',note:''},
  {id:27,person:'shower',personName:'李鎮宇',month:'2025-10',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-10-01',item:'月度費用申請（匯總）',amount:4103,category:'加油',receipt:'無',status:'approved',note:''},
  {id:28,person:'shower',personName:'李鎮宇',month:'2025-10',caseKey:'YT-VOL-2025-001',caseName:'林口三井',date:'2025-10-01',item:'月度費用申請（匯總）',amount:1160,category:'加油',receipt:'無',status:'approved',note:''},
  {id:29,person:'shower',personName:'李鎮宇',month:'2025-10',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-10-01',item:'月度費用申請（匯總）',amount:5397,category:'餐費',receipt:'無',status:'approved',note:''},
  {id:30,person:'shower',personName:'李鎮宇',month:'2025-09',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-09-01',item:'月度費用申請（匯總）',amount:865,category:'停車',receipt:'無',status:'approved',note:''},
  {id:31,person:'shower',personName:'李鎮宇',month:'2025-09',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-09-01',item:'月度費用申請（匯總）',amount:7071,category:'加油',receipt:'無',status:'approved',note:''},
  {id:32,person:'shower',personName:'李鎮宇',month:'2025-09',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-09-01',item:'月度費用申請（匯總）',amount:38978,category:'辦公用品',receipt:'無',status:'approved',note:''},
  {id:33,person:'shower',personName:'李鎮宇',month:'2025-09',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-09-01',item:'月度費用申請（匯總）',amount:6690,category:'餐費',receipt:'無',status:'approved',note:''},
  {id:34,person:'shower',personName:'李鎮宇',month:'2025-08',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-08-01',item:'月度費用申請（匯總）',amount:615,category:'停車',receipt:'無',status:'approved',note:''},
  {id:35,person:'shower',personName:'李鎮宇',month:'2025-08',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-08-01',item:'月度費用申請（匯總）',amount:5700,category:'加油',receipt:'無',status:'approved',note:''},
  {id:36,person:'shower',personName:'李鎮宇',month:'2025-08',caseKey:'YT-VOL-2025-002',caseName:'中和Volvo會議室',date:'2025-08-01',item:'月度費用申請（匯總）',amount:202,category:'工程',receipt:'無',status:'approved',note:'中和Volvo四樓會議室'},
  {id:37,person:'shower',personName:'李鎮宇',month:'2025-08',caseKey:'固定開銷',caseName:'固定開銷',date:'2025-08-01',item:'月度費用申請（匯總）',amount:750,category:'工程',receipt:'無',status:'approved',note:'宇德公司'},
  {id:38,person:'shower',personName:'李鎮宇',month:'2025-07',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-07-01',item:'月度費用申請（匯總）',amount:6250,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:39,person:'shower',personName:'李鎮宇',month:'2025-07',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-07-01',item:'月度費用申請（匯總）',amount:70,category:'停車',receipt:'無',status:'approved',note:''},
  {id:40,person:'shower',personName:'李鎮宇',month:'2025-07',caseKey:'YT-VOL-2025-002',caseName:'中和Volvo會議室',date:'2025-07-01',item:'月度費用申請（匯總）',amount:845,category:'停車',receipt:'無',status:'approved',note:'中和Volvo四樓會議室'},
  {id:41,person:'shower',personName:'李鎮宇',month:'2025-07',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-07-01',item:'月度費用申請（匯總）',amount:3435,category:'加油',receipt:'無',status:'approved',note:''},
  {id:42,person:'shower',personName:'李鎮宇',month:'2025-07',caseKey:'YT-VOL-2025-002',caseName:'中和Volvo會議室',date:'2025-07-01',item:'月度費用申請（匯總）',amount:12445,category:'加油',receipt:'無',status:'approved',note:'中和Volvo四樓會議室'},
  {id:43,person:'shower',personName:'李鎮宇',month:'2025-06',caseKey:'YT-VOL-2025-002',caseName:'中和Volvo會議室',date:'2025-06-01',item:'月度費用申請（匯總）',amount:2180,category:'交際費',receipt:'無',status:'approved',note:'中和Volvo四樓會議室'},
  {id:44,person:'shower',personName:'李鎮宇',month:'2025-06',caseKey:'YT-VOL-2025-002',caseName:'中和Volvo會議室',date:'2025-06-01',item:'月度費用申請（匯總）',amount:450,category:'停車',receipt:'無',status:'approved',note:'中和Volvo四樓會議室'},
  {id:45,person:'shower',personName:'李鎮宇',month:'2025-06',caseKey:'YT-VOL-2025-002',caseName:'中和Volvo會議室',date:'2025-06-01',item:'月度費用申請（匯總）',amount:10664,category:'加油',receipt:'無',status:'approved',note:'中和Volvo四樓會議室'},
  {id:46,person:'shower',personName:'李鎮宇',month:'2025-06',caseKey:'YT-VOL-2025-002',caseName:'中和Volvo會議室',date:'2025-06-01',item:'月度費用申請（匯總）',amount:240,category:'工程',receipt:'無',status:'approved',note:'中和Volvo四樓會議室'},
  {id:47,person:'shower',personName:'李鎮宇',month:'2025-06',caseKey:'固定開銷',caseName:'固定開銷',date:'2025-06-01',item:'月度費用申請（匯總）',amount:4800,category:'雜支',receipt:'無',status:'approved',note:'宇德公司'},
  {id:48,person:'shower',personName:'李鎮宇',month:'2025-06',caseKey:'YT-VOL-2025-002',caseName:'中和Volvo會議室',date:'2025-06-01',item:'月度費用申請（匯總）',amount:850,category:'餐費',receipt:'無',status:'approved',note:'中和Volvo四樓會議室'},
  {id:49,person:'shower',personName:'李鎮宇',month:'2025-05',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-05-01',item:'月度費用申請（匯總）',amount:8680,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:50,person:'shower',personName:'李鎮宇',month:'2025-05',caseKey:'YT-KYG-2025-002',caseName:'濱江凱揚',date:'2025-05-01',item:'月度費用申請（匯總）',amount:330,category:'停車',receipt:'無',status:'approved',note:'濱江'},
  {id:51,person:'shower',personName:'李鎮宇',month:'2025-05',caseKey:'YT-KYG-2025-002',caseName:'濱江凱揚',date:'2025-05-01',item:'月度費用申請（匯總）',amount:10599,category:'加油',receipt:'無',status:'approved',note:'濱江'},
  {id:52,person:'lien',personName:'連星羽',month:'2025-12',caseKey:'YT-UPY-2026-001',caseName:'上洋高雄',date:'2025-12-01',item:'月度費用申請（匯總）',amount:2660,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:53,person:'lien',personName:'連星羽',month:'2025-12',caseKey:'YT-UPY-2026-001',caseName:'上洋高雄',date:'2025-12-01',item:'月度費用申請（匯總）',amount:700,category:'停車',receipt:'無',status:'approved',note:''},
  {id:54,person:'lien',personName:'連星羽',month:'2025-12',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-12-01',item:'月度費用申請（匯總）',amount:250,category:'停車',receipt:'無',status:'approved',note:''},
  {id:55,person:'lien',personName:'連星羽',month:'2025-12',caseKey:'YT-WWF-2025-001',caseName:'文威豐',date:'2025-12-01',item:'月度費用申請（匯總）',amount:530,category:'停車',receipt:'無',status:'approved',note:''},
  {id:56,person:'lien',personName:'連星羽',month:'2025-12',caseKey:'YT-UPY-2026-001',caseName:'上洋高雄',date:'2025-12-01',item:'月度費用申請（匯總）',amount:21150,category:'其他',receipt:'無',status:'approved',note:''},
  {id:57,person:'lien',personName:'連星羽',month:'2025-12',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-12-01',item:'月度費用申請（匯總）',amount:4497,category:'加油',receipt:'無',status:'approved',note:''},
  {id:58,person:'lien',personName:'連星羽',month:'2025-12',caseKey:'YT-WWF-2025-001',caseName:'文威豐',date:'2025-12-01',item:'月度費用申請（匯總）',amount:3832,category:'加油',receipt:'無',status:'approved',note:''},
  {id:59,person:'lien',personName:'連星羽',month:'2025-12',caseKey:'YT-KYG-2025-001',caseName:'同協路凱揚',date:'2025-12-01',item:'月度費用申請（匯總）',amount:3388,category:'工程',receipt:'無',status:'approved',note:'凱揚汽車'},
  {id:60,person:'lien',personName:'連星羽',month:'2025-12',caseKey:'YT-WWF-2025-001',caseName:'文威豐',date:'2025-12-01',item:'月度費用申請（匯總）',amount:2600,category:'工程',receipt:'無',status:'approved',note:''},
  {id:61,person:'lien',personName:'連星羽',month:'2025-12',caseKey:'YT-UPY-2026-001',caseName:'上洋高雄',date:'2025-12-01',item:'月度費用申請（匯總）',amount:2278,category:'雜支',receipt:'無',status:'approved',note:''},
  {id:62,person:'lien',personName:'連星羽',month:'2025-12',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-12-01',item:'月度費用申請（匯總）',amount:1000,category:'餐費',receipt:'無',status:'approved',note:''},
  {id:63,person:'lien',personName:'連星羽',month:'2025-12',caseKey:'YT-WWF-2025-001',caseName:'文威豐',date:'2025-12-01',item:'月度費用申請（匯總）',amount:2275,category:'餐費',receipt:'無',status:'approved',note:''},
  {id:64,person:'lien',personName:'連星羽',month:'2025-11',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-11-01',item:'月度費用申請（匯總）',amount:60,category:'停車',receipt:'無',status:'approved',note:''},
  {id:65,person:'lien',personName:'連星羽',month:'2025-11',caseKey:'YT-KYG-2025-001',caseName:'同協路凱揚',date:'2025-11-01',item:'月度費用申請（匯總）',amount:220,category:'停車',receipt:'無',status:'approved',note:'凱揚汽車'},
  {id:66,person:'lien',personName:'連星羽',month:'2025-11',caseKey:'YT-WWF-2025-001',caseName:'文威豐',date:'2025-11-01',item:'月度費用申請（匯總）',amount:570,category:'停車',receipt:'無',status:'approved',note:''},
  {id:67,person:'lien',personName:'連星羽',month:'2025-11',caseKey:'YT-VOL-2025-001',caseName:'林口三井',date:'2025-11-01',item:'月度費用申請（匯總）',amount:330,category:'停車',receipt:'無',status:'approved',note:''},
  {id:68,person:'lien',personName:'連星羽',month:'2025-11',caseKey:'YT-SUZ-2025-002',caseName:'民族 Suzuki',date:'2025-11-01',item:'月度費用申請（匯總）',amount:90,category:'停車',receipt:'無',status:'approved',note:'民族Suzuki'},
  {id:69,person:'lien',personName:'連星羽',month:'2025-11',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-11-01',item:'月度費用申請（匯總）',amount:6761,category:'加油',receipt:'無',status:'approved',note:''},
  {id:70,person:'lien',personName:'連星羽',month:'2025-11',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-11-01',item:'月度費用申請（匯總）',amount:1470,category:'工程',receipt:'無',status:'approved',note:''},
  {id:71,person:'lien',personName:'連星羽',month:'2025-11',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-11-01',item:'月度費用申請（匯總）',amount:1076,category:'雜支',receipt:'無',status:'approved',note:''},
  {id:72,person:'lien',personName:'連星羽',month:'2025-11',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-11-01',item:'月度費用申請（匯總）',amount:1453,category:'餐費',receipt:'無',status:'approved',note:''},
  {id:73,person:'lien',personName:'連星羽',month:'2025-11',caseKey:'YT-KYG-2025-001',caseName:'同協路凱揚',date:'2025-11-01',item:'月度費用申請（匯總）',amount:405,category:'餐費',receipt:'無',status:'approved',note:'凱揚汽車'},
  {id:74,person:'lien',personName:'連星羽',month:'2025-10',caseKey:'YT-UPY-2026-001',caseName:'上洋高雄',date:'2025-10-01',item:'月度費用申請（匯總）',amount:2720,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:75,person:'lien',personName:'連星羽',month:'2025-10',caseKey:'YT-UPY-2026-001',caseName:'上洋高雄',date:'2025-10-01',item:'月度費用申請（匯總）',amount:150,category:'停車',receipt:'無',status:'approved',note:''},
  {id:76,person:'lien',personName:'連星羽',month:'2025-10',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-10-01',item:'月度費用申請（匯總）',amount:285,category:'停車',receipt:'無',status:'approved',note:''},
  {id:77,person:'lien',personName:'連星羽',month:'2025-10',caseKey:'YT-WWF-2025-001',caseName:'文威豐',date:'2025-10-01',item:'月度費用申請（匯總）',amount:560,category:'停車',receipt:'無',status:'approved',note:''},
  {id:78,person:'lien',personName:'連星羽',month:'2025-10',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-10-01',item:'月度費用申請（匯總）',amount:225,category:'停車',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:79,person:'lien',personName:'連星羽',month:'2025-10',caseKey:'YT-VOL-2025-001',caseName:'林口三井',date:'2025-10-01',item:'月度費用申請（匯總）',amount:250,category:'停車',receipt:'無',status:'approved',note:''},
  {id:80,person:'lien',personName:'連星羽',month:'2025-10',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-10-01',item:'月度費用申請（匯總）',amount:5035,category:'加油',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:81,person:'lien',personName:'連星羽',month:'2025-10',caseKey:'YT-VOL-2025-001',caseName:'林口三井',date:'2025-10-01',item:'月度費用申請（匯總）',amount:1744,category:'加油',receipt:'無',status:'approved',note:''},
  {id:82,person:'lien',personName:'連星羽',month:'2025-10',caseKey:'YT-WWF-2025-001',caseName:'文威豐',date:'2025-10-01',item:'月度費用申請（匯總）',amount:3422,category:'工程',receipt:'無',status:'approved',note:''},
  {id:83,person:'lien',personName:'連星羽',month:'2025-10',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-10-01',item:'月度費用申請（匯總）',amount:2535,category:'工程',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:84,person:'lien',personName:'連星羽',month:'2025-10',caseKey:'YT-UPY-2026-001',caseName:'上洋高雄',date:'2025-10-01',item:'月度費用申請（匯總）',amount:436,category:'餐費',receipt:'無',status:'approved',note:''},
  {id:85,person:'lien',personName:'連星羽',month:'2025-10',caseKey:'YT-WWF-2025-001',caseName:'文威豐',date:'2025-10-01',item:'月度費用申請（匯總）',amount:291,category:'餐費',receipt:'無',status:'approved',note:''},
  {id:86,person:'lien',personName:'連星羽',month:'2025-09',caseKey:'YT-VOL-2025-001',caseName:'林口三井',date:'2025-09-01',item:'月度費用申請（匯總）',amount:1055,category:'停車',receipt:'無',status:'approved',note:'vovo林口三井'},
  {id:87,person:'lien',personName:'連星羽',month:'2025-09',caseKey:'YT-VOL-2025-001',caseName:'林口三井',date:'2025-09-01',item:'月度費用申請（匯總）',amount:1664,category:'加油',receipt:'無',status:'approved',note:'vovo林口三井'},
  {id:88,person:'lien',personName:'連星羽',month:'2025-09',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-09-01',item:'月度費用申請（匯總）',amount:2219,category:'加油',receipt:'無',status:'approved',note:''},
  {id:89,person:'lien',personName:'連星羽',month:'2025-09',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-09-01',item:'月度費用申請（匯總）',amount:4564,category:'加油',receipt:'無',status:'approved',note:''},
  {id:90,person:'lien',personName:'連星羽',month:'2025-09',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-09-01',item:'月度費用申請（匯總）',amount:1901,category:'工程',receipt:'無',status:'approved',note:''},
  {id:91,person:'lien',personName:'連星羽',month:'2025-09',caseKey:'YT-VOL-2025-001',caseName:'林口三井',date:'2025-09-01',item:'月度費用申請（匯總）',amount:1039,category:'辦公用品',receipt:'無',status:'approved',note:'vovo林口三井'},
  {id:92,person:'lien',personName:'連星羽',month:'2025-09',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-09-01',item:'月度費用申請（匯總）',amount:1150,category:'餐費',receipt:'無',status:'approved',note:''},
  {id:93,person:'lien',personName:'連星羽',month:'2025-08',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-08-01',item:'月度費用申請（匯總）',amount:30,category:'停車',receipt:'無',status:'approved',note:''},
  {id:94,person:'lien',personName:'連星羽',month:'2025-08',caseKey:'固定開銷',caseName:'固定開銷',date:'2025-08-01',item:'月度費用申請（匯總）',amount:200,category:'停車',receipt:'無',status:'approved',note:'宇德公司'},
  {id:95,person:'lien',personName:'連星羽',month:'2025-08',caseKey:'YT-UPY-2026-001',caseName:'上洋高雄',date:'2025-08-01',item:'月度費用申請（匯總）',amount:1702,category:'加油',receipt:'無',status:'approved',note:''},
  {id:96,person:'lien',personName:'連星羽',month:'2025-08',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-08-01',item:'月度費用申請（匯總）',amount:5169,category:'加油',receipt:'無',status:'approved',note:''},
  {id:97,person:'lien',personName:'連星羽',month:'2025-08',caseKey:'YT-CHL-2025-001',caseName:'俊林辦公室',date:'2025-08-01',item:'月度費用申請（匯總）',amount:140,category:'工程',receipt:'無',status:'approved',note:''},
  {id:98,person:'lien',personName:'連星羽',month:'2025-08',caseKey:'固定開銷',caseName:'固定開銷',date:'2025-08-01',item:'月度費用申請（匯總）',amount:300,category:'工程',receipt:'無',status:'approved',note:'宇德公司'},
  {id:99,person:'lien',personName:'連星羽',month:'2025-08',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-08-01',item:'月度費用申請（匯總）',amount:60,category:'辦公用品',receipt:'無',status:'approved',note:''},
  {id:100,person:'lien',personName:'連星羽',month:'2025-07',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-07-01',item:'月度費用申請（匯總）',amount:3080,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:101,person:'lien',personName:'連星羽',month:'2025-07',caseKey:'YT-VOL-2025-001',caseName:'林口三井',date:'2025-07-01',item:'月度費用申請（匯總）',amount:30,category:'停車',receipt:'無',status:'approved',note:'VOLVO三井'},
  {id:102,person:'lien',personName:'連星羽',month:'2025-07',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-07-01',item:'月度費用申請（匯總）',amount:300,category:'停車',receipt:'無',status:'approved',note:''},
  {id:103,person:'lien',personName:'連星羽',month:'2025-07',caseKey:'固定開銷',caseName:'固定開銷',date:'2025-07-01',item:'月度費用申請（匯總）',amount:60,category:'停車',receipt:'無',status:'approved',note:'宇德公司'},
  {id:104,person:'lien',personName:'連星羽',month:'2025-07',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-07-01',item:'月度費用申請（匯總）',amount:3319,category:'加油',receipt:'無',status:'approved',note:''},
  {id:105,person:'lien',personName:'連星羽',month:'2025-07',caseKey:'YT-CHL-2025-001',caseName:'俊林辦公室',date:'2025-07-01',item:'月度費用申請（匯總）',amount:1690,category:'加油',receipt:'無',status:'approved',note:''},
  {id:106,person:'lien',personName:'連星羽',month:'2025-07',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-07-01',item:'月度費用申請（匯總）',amount:2682,category:'工程',receipt:'無',status:'approved',note:''},
  {id:107,person:'lien',personName:'連星羽',month:'2025-07',caseKey:'YT-CHL-2025-001',caseName:'俊林辦公室',date:'2025-07-01',item:'月度費用申請（匯總）',amount:3686,category:'工程',receipt:'無',status:'approved',note:''},
  {id:108,person:'lien',personName:'連星羽',month:'2025-07',caseKey:'YT-CHL-2025-001',caseName:'俊林辦公室',date:'2025-07-01',item:'月度費用申請（匯總）',amount:650,category:'餐費',receipt:'無',status:'approved',note:''},
  {id:109,person:'lien',personName:'連星羽',month:'2025-06',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-06-01',item:'月度費用申請（匯總）',amount:8276,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:110,person:'lien',personName:'連星羽',month:'2025-06',caseKey:'YT-UPY-2026-001',caseName:'上洋高雄',date:'2025-06-01',item:'月度費用申請（匯總）',amount:1290,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:111,person:'lien',personName:'連星羽',month:'2025-06',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-06-01',item:'月度費用申請（匯總）',amount:1180,category:'停車',receipt:'無',status:'approved',note:''},
  {id:112,person:'lien',personName:'連星羽',month:'2025-06',caseKey:'YT-CHL-2025-001',caseName:'俊林辦公室',date:'2025-06-01',item:'月度費用申請（匯總）',amount:4863,category:'加油',receipt:'無',status:'approved',note:''},
  {id:113,person:'lien',personName:'連星羽',month:'2025-06',caseKey:'YT-CHL-2025-001',caseName:'俊林辦公室',date:'2025-06-01',item:'月度費用申請（匯總）',amount:6690,category:'工程',receipt:'無',status:'approved',note:''},
  {id:114,person:'lien',personName:'連星羽',month:'2025-06',caseKey:'YT-SUZ-2025-002',caseName:'民族 Suzuki',date:'2025-06-01',item:'月度費用申請（匯總）',amount:436,category:'工程',receipt:'無',status:'approved',note:'民族'},
  {id:115,person:'lien',personName:'連星羽',month:'2025-06',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-06-01',item:'月度費用申請（匯總）',amount:16,category:'辦公用品',receipt:'無',status:'approved',note:''},
  {id:116,person:'lien',personName:'連星羽',month:'2025-05',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-05-01',item:'月度費用申請（匯總）',amount:6600,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:117,person:'lien',personName:'連星羽',month:'2025-05',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-05-01',item:'月度費用申請（匯總）',amount:1240,category:'停車',receipt:'無',status:'approved',note:''},
  {id:118,person:'lien',personName:'連星羽',month:'2025-05',caseKey:'YT-CHL-2025-001',caseName:'俊林辦公室',date:'2025-05-01',item:'月度費用申請（匯總）',amount:75,category:'停車',receipt:'無',status:'approved',note:''},
  {id:119,person:'lien',personName:'連星羽',month:'2025-05',caseKey:'YT-KYG-2025-002',caseName:'濱江凱揚',date:'2025-05-01',item:'月度費用申請（匯總）',amount:105,category:'停車',receipt:'無',status:'approved',note:'濱江'},
  {id:120,person:'lien',personName:'連星羽',month:'2025-05',caseKey:'YT-CHL-2025-001',caseName:'俊林辦公室',date:'2025-05-01',item:'月度費用申請（匯總）',amount:4845,category:'加油',receipt:'無',status:'approved',note:''},
  {id:121,person:'lien',personName:'連星羽',month:'2025-05',caseKey:'YT-KYG-2025-002',caseName:'濱江凱揚',date:'2025-05-01',item:'月度費用申請（匯總）',amount:3342,category:'加油',receipt:'無',status:'approved',note:'濱江'},
  {id:122,person:'lien',personName:'連星羽',month:'2025-05',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-05-01',item:'月度費用申請（匯總）',amount:275,category:'工程',receipt:'無',status:'approved',note:''},
  {id:123,person:'lien',personName:'連星羽',month:'2025-05',caseKey:'YT-CHL-2025-001',caseName:'俊林辦公室',date:'2025-05-01',item:'月度費用申請（匯總）',amount:335,category:'工程',receipt:'無',status:'approved',note:''},
  {id:124,person:'lien',personName:'連星羽',month:'2025-05',caseKey:'YT-KYG-2025-002',caseName:'濱江凱揚',date:'2025-05-01',item:'月度費用申請（匯總）',amount:354,category:'工程',receipt:'無',status:'approved',note:'濱江'},
  {id:125,person:'lien',personName:'連星羽',month:'2025-05',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-05-01',item:'月度費用申請（匯總）',amount:330,category:'餐費',receipt:'無',status:'approved',note:''},
  {id:126,person:'lien',personName:'連星羽',month:'2025-05',caseKey:'YT-SUZ-2025-002',caseName:'民族 Suzuki',date:'2025-05-01',item:'月度費用申請（匯總）',amount:455,category:'餐費',receipt:'無',status:'approved',note:'民族'},
  {id:127,person:'peng',personName:'彭俞豪',month:'2025-12',caseKey:'YT-UPY-2026-001',caseName:'上洋高雄',date:'2025-12-01',item:'月度費用申請（匯總）',amount:9945,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:128,person:'peng',personName:'彭俞豪',month:'2025-12',caseKey:'YT-KYG-2025-001',caseName:'同協路凱揚',date:'2025-12-01',item:'月度費用申請（匯總）',amount:1500,category:'交通費',receipt:'無',status:'approved',note:'凱揚汽車'},
  {id:129,person:'peng',personName:'彭俞豪',month:'2025-12',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-12-01',item:'月度費用申請（匯總）',amount:651,category:'交通費',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:130,person:'peng',personName:'彭俞豪',month:'2025-12',caseKey:'YT-UPY-2026-001',caseName:'上洋高雄',date:'2025-12-01',item:'月度費用申請（匯總）',amount:10000,category:'住宿',receipt:'無',status:'approved',note:''},
  {id:131,person:'peng',personName:'彭俞豪',month:'2025-12',caseKey:'YT-UPY-2026-001',caseName:'上洋高雄',date:'2025-12-01',item:'月度費用申請（匯總）',amount:375,category:'停車',receipt:'無',status:'approved',note:''},
  {id:132,person:'peng',personName:'彭俞豪',month:'2025-12',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-12-01',item:'月度費用申請（匯總）',amount:240,category:'停車',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:133,person:'peng',personName:'彭俞豪',month:'2025-12',caseKey:'YT-KYG-2025-001',caseName:'同協路凱揚',date:'2025-12-01',item:'月度費用申請（匯總）',amount:1591,category:'加油',receipt:'無',status:'approved',note:'凱揚汽車'},
  {id:134,person:'peng',personName:'彭俞豪',month:'2025-12',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-12-01',item:'月度費用申請（匯總）',amount:1706,category:'加油',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:135,person:'peng',personName:'彭俞豪',month:'2025-12',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-12-01',item:'月度費用申請（匯總）',amount:62157,category:'工程',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:136,person:'peng',personName:'彭俞豪',month:'2025-12',caseKey:'YT-KYG-2025-001',caseName:'同協路凱揚',date:'2025-12-01',item:'月度費用申請（匯總）',amount:210,category:'餐費',receipt:'無',status:'approved',note:'凱揚汽車'},
  {id:137,person:'peng',personName:'彭俞豪',month:'2025-12',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-12-01',item:'月度費用申請（匯總）',amount:4059,category:'餐費',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:138,person:'peng',personName:'彭俞豪',month:'2025-11',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-11-01',item:'月度費用申請（匯總）',amount:735,category:'停車',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:139,person:'peng',personName:'彭俞豪',month:'2025-11',caseKey:'YT-KYG-2025-001',caseName:'同協路凱揚',date:'2025-11-01',item:'月度費用申請（匯總）',amount:-4828,category:'其他',receipt:'無',status:'approved',note:'凱揚汽車'},
  {id:140,person:'peng',personName:'彭俞豪',month:'2025-11',caseKey:'YT-SUZ-2025-002',caseName:'民族 Suzuki',date:'2025-11-01',item:'月度費用申請（匯總）',amount:-4012,category:'其他',receipt:'無',status:'approved',note:'民族服務suzuki'},
  {id:141,person:'peng',personName:'彭俞豪',month:'2025-11',caseKey:'YT-KYG-2025-001',caseName:'同協路凱揚',date:'2025-11-01',item:'月度費用申請（匯總）',amount:4875,category:'加油',receipt:'無',status:'approved',note:'凱揚汽車'},
  {id:142,person:'peng',personName:'彭俞豪',month:'2025-11',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-11-01',item:'月度費用申請（匯總）',amount:3753,category:'加油',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:143,person:'peng',personName:'彭俞豪',month:'2025-11',caseKey:'YT-SUZ-2025-002',caseName:'民族 Suzuki',date:'2025-11-01',item:'月度費用申請（匯總）',amount:1623,category:'加油',receipt:'無',status:'approved',note:'民族服務suzuki'},
  {id:144,person:'peng',personName:'彭俞豪',month:'2025-11',caseKey:'YT-KYG-2025-001',caseName:'同協路凱揚',date:'2025-11-01',item:'月度費用申請（匯總）',amount:120918,category:'工程',receipt:'無',status:'approved',note:'凱揚汽車'},
  {id:145,person:'peng',personName:'彭俞豪',month:'2025-11',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-11-01',item:'月度費用申請（匯總）',amount:6658,category:'工程',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:146,person:'peng',personName:'彭俞豪',month:'2025-11',caseKey:'YT-SUZ-2025-002',caseName:'民族 Suzuki',date:'2025-11-01',item:'月度費用申請（匯總）',amount:15691,category:'工程',receipt:'無',status:'approved',note:'民族服務suzuki'},
  {id:147,person:'peng',personName:'彭俞豪',month:'2025-11',caseKey:'YT-KYG-2025-001',caseName:'同協路凱揚',date:'2025-11-01',item:'月度費用申請（匯總）',amount:3574,category:'餐費',receipt:'無',status:'approved',note:'凱揚汽車'},
  {id:148,person:'peng',personName:'彭俞豪',month:'2025-11',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-11-01',item:'月度費用申請（匯總）',amount:4273,category:'餐費',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:149,person:'peng',personName:'彭俞豪',month:'2025-11',caseKey:'YT-SUZ-2025-002',caseName:'民族 Suzuki',date:'2025-11-01',item:'月度費用申請（匯總）',amount:200,category:'餐費',receipt:'無',status:'approved',note:'民族服務suzuki'},
  {id:150,person:'peng',personName:'彭俞豪',month:'2025-10',caseKey:'YT-UPY-2026-001',caseName:'上洋高雄',date:'2025-10-01',item:'月度費用申請（匯總）',amount:2830,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:151,person:'peng',personName:'彭俞豪',month:'2025-10',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-10-01',item:'月度費用申請（匯總）',amount:2260,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:152,person:'peng',personName:'彭俞豪',month:'2025-10',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-10-01',item:'月度費用申請（匯總）',amount:3796,category:'交通費',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:153,person:'peng',personName:'彭俞豪',month:'2025-10',caseKey:'YT-VOL-2025-001',caseName:'林口三井',date:'2025-10-01',item:'月度費用申請（匯總）',amount:2895,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:154,person:'peng',personName:'彭俞豪',month:'2025-10',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-10-01',item:'月度費用申請（匯總）',amount:390,category:'停車',receipt:'無',status:'approved',note:''},
  {id:155,person:'peng',personName:'彭俞豪',month:'2025-10',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-10-01',item:'月度費用申請（匯總）',amount:150,category:'停車',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:156,person:'peng',personName:'彭俞豪',month:'2025-10',caseKey:'YT-VOL-2025-001',caseName:'林口三井',date:'2025-10-01',item:'月度費用申請（匯總）',amount:60,category:'停車',receipt:'無',status:'approved',note:''},
  {id:157,person:'peng',personName:'彭俞豪',month:'2025-10',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-10-01',item:'月度費用申請（匯總）',amount:670,category:'工程',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:158,person:'peng',personName:'彭俞豪',month:'2025-10',caseKey:'YT-VOL-2025-001',caseName:'林口三井',date:'2025-10-01',item:'月度費用申請（匯總）',amount:3285,category:'工程',receipt:'無',status:'approved',note:''},
  {id:159,person:'peng',personName:'彭俞豪',month:'2025-10',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-10-01',item:'月度費用申請（匯總）',amount:666,category:'餐費',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:160,person:'peng',personName:'彭俞豪',month:'2025-10',caseKey:'YT-VOL-2025-001',caseName:'林口三井',date:'2025-10-01',item:'月度費用申請（匯總）',amount:771,category:'餐費',receipt:'無',status:'approved',note:''},
  {id:161,person:'peng',personName:'彭俞豪',month:'2025-09',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-09-01',item:'月度費用申請（匯總）',amount:250,category:'停車',receipt:'無',status:'approved',note:''},
  {id:162,person:'peng',personName:'彭俞豪',month:'2025-09',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-09-01',item:'月度費用申請（匯總）',amount:4668,category:'加油',receipt:'無',status:'approved',note:''},
  {id:163,person:'peng',personName:'彭俞豪',month:'2025-09',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-09-01',item:'月度費用申請（匯總）',amount:1529,category:'工程',receipt:'無',status:'approved',note:''},
  {id:164,person:'peng',personName:'彭俞豪',month:'2025-09',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-09-01',item:'月度費用申請（匯總）',amount:2500,category:'水電瓦斯',receipt:'無',status:'approved',note:''},
  {id:165,person:'peng',personName:'彭俞豪',month:'2025-08',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-08-01',item:'月度費用申請（匯總）',amount:5222,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:166,person:'peng',personName:'彭俞豪',month:'2025-08',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-08-01',item:'月度費用申請（匯總）',amount:100,category:'停車',receipt:'無',status:'approved',note:''},
  {id:167,person:'peng',personName:'彭俞豪',month:'2025-08',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-08-01',item:'月度費用申請（匯總）',amount:129,category:'雜支',receipt:'無',status:'approved',note:''},
  {id:168,person:'peng',personName:'彭俞豪',month:'2025-07',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-07-01',item:'月度費用申請（匯總）',amount:18875,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:169,person:'peng',personName:'彭俞豪',month:'2025-07',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-07-01',item:'月度費用申請（匯總）',amount:1427,category:'住宿',receipt:'無',status:'approved',note:''},
  {id:170,person:'peng',personName:'彭俞豪',month:'2025-07',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-07-01',item:'月度費用申請（匯總）',amount:1400,category:'停車',receipt:'無',status:'approved',note:''},
  {id:171,person:'peng',personName:'彭俞豪',month:'2025-07',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-07-01',item:'月度費用申請（匯總）',amount:7820,category:'加油',receipt:'無',status:'approved',note:''},
  {id:172,person:'peng',personName:'彭俞豪',month:'2025-07',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-07-01',item:'月度費用申請（匯總）',amount:6443,category:'工程',receipt:'無',status:'approved',note:''},
  {id:173,person:'peng',personName:'彭俞豪',month:'2025-07',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-07-01',item:'月度費用申請（匯總）',amount:1750,category:'雜支',receipt:'無',status:'approved',note:''},
  {id:174,person:'peng',personName:'彭俞豪',month:'2025-07',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-07-01',item:'月度費用申請（匯總）',amount:10887,category:'餐費',receipt:'無',status:'approved',note:''},
  {id:175,person:'peng',personName:'彭俞豪',month:'2025-06',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-06-01',item:'月度費用申請（匯總）',amount:1500,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:176,person:'peng',personName:'彭俞豪',month:'2025-06',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-06-01',item:'月度費用申請（匯總）',amount:8033,category:'加油',receipt:'無',status:'approved',note:''},
  {id:177,person:'peng',personName:'彭俞豪',month:'2025-06',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-06-01',item:'月度費用申請（匯總）',amount:7132,category:'工程',receipt:'無',status:'approved',note:''},
  {id:178,person:'peng',personName:'彭俞豪',month:'2025-06',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-06-01',item:'月度費用申請（匯總）',amount:42,category:'辦公用品',receipt:'無',status:'approved',note:''},
  {id:179,person:'peng',personName:'彭俞豪',month:'2025-06',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-06-01',item:'月度費用申請（匯總）',amount:1777,category:'餐費',receipt:'無',status:'approved',note:''},
  {id:180,person:'peng',personName:'彭俞豪',month:'2025-05',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-05-01',item:'月度費用申請（匯總）',amount:3795,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:181,person:'peng',personName:'彭俞豪',month:'2025-05',caseKey:'YT-JET-2025-001',caseName:'凱銳嘉義',date:'2025-05-01',item:'月度費用申請（匯總）',amount:420,category:'交通費',receipt:'無',status:'approved',note:''},
  {id:182,person:'peng',personName:'彭俞豪',month:'2025-05',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-05-01',item:'月度費用申請（匯總）',amount:75000,category:'住宿',receipt:'無',status:'approved',note:''},
  {id:183,person:'peng',personName:'彭俞豪',month:'2025-05',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-05-01',item:'月度費用申請（匯總）',amount:270,category:'停車',receipt:'無',status:'approved',note:''},
  {id:184,person:'peng',personName:'彭俞豪',month:'2025-05',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-05-01',item:'月度費用申請（匯總）',amount:11619,category:'加油',receipt:'無',status:'approved',note:''},
  {id:185,person:'peng',personName:'彭俞豪',month:'2025-05',caseKey:'YT-SUZ-2025-003',caseName:'南港 Suzuki',date:'2025-05-01',item:'月度費用申請（匯總）',amount:478,category:'工程',receipt:'無',status:'approved',note:'suzuki南港'},
  {id:186,person:'peng',personName:'彭俞豪',month:'2025-05',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-05-01',item:'月度費用申請（匯總）',amount:46993,category:'工程',receipt:'無',status:'approved',note:''},
  {id:187,person:'peng',personName:'彭俞豪',month:'2025-05',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-05-01',item:'月度費用申請（匯總）',amount:5123,category:'雜支',receipt:'無',status:'approved',note:''},
  {id:188,person:'peng',personName:'彭俞豪',month:'2025-05',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-05-01',item:'月度費用申請（匯總）',amount:2340,category:'餐費',receipt:'無',status:'approved',note:''},
  {id:189,person:'nc',personName:'鄭詩褣',month:'2025-12',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-12-01',item:'月度費用申請（匯總）',amount:397,category:'其他',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:190,person:'nc',personName:'鄭詩褣',month:'2025-12',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-12-01',item:'月度費用申請（匯總）',amount:512,category:'郵資',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:191,person:'nc',personName:'鄭詩褣',month:'2025-12',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-12-01',item:'月度費用申請（匯總）',amount:1700,category:'雜支',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:192,person:'nc',personName:'鄭詩褣',month:'2025-11',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-11-01',item:'月度費用申請（匯總）',amount:397,category:'其他',receipt:'無',status:'approved',note:''},
  {id:193,person:'nc',personName:'鄭詩褣',month:'2025-11',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-11-01',item:'月度費用申請（匯總）',amount:28015,category:'工程',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:194,person:'nc',personName:'鄭詩褣',month:'2025-11',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-11-01',item:'月度費用申請（匯總）',amount:794,category:'辦公用品',receipt:'無',status:'approved',note:''},
  {id:195,person:'nc',personName:'鄭詩褣',month:'2025-11',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-11-01',item:'月度費用申請（匯總）',amount:212,category:'郵資',receipt:'無',status:'approved',note:''},
  {id:196,person:'nc',personName:'鄭詩褣',month:'2025-11',caseKey:'YT-KYG-2025-001',caseName:'同協路凱揚',date:'2025-11-01',item:'月度費用申請（匯總）',amount:486,category:'郵資',receipt:'無',status:'approved',note:'凱揚汽車'},
  {id:197,person:'nc',personName:'鄭詩褣',month:'2025-11',caseKey:'YT-SUZ-2025-001',caseName:'木柵 Suzuki',date:'2025-11-01',item:'月度費用申請（匯總）',amount:60,category:'郵資',receipt:'無',status:'approved',note:'木柵Suzuki'},
  {id:198,person:'nc',personName:'鄭詩褣',month:'2025-11',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-11-01',item:'月度費用申請（匯總）',amount:2952,category:'雜支',receipt:'無',status:'approved',note:''},
  {id:199,person:'nc',personName:'鄭詩褣',month:'2025-10',caseKey:'固定開銷',caseName:'固定開銷',date:'2025-10-01',item:'月度費用申請（匯總）',amount:2097,category:'其他',receipt:'無',status:'approved',note:'宇德公司'},
  {id:200,person:'nc',personName:'鄭詩褣',month:'2025-10',caseKey:'固定開銷',caseName:'固定開銷',date:'2025-10-01',item:'月度費用申請（匯總）',amount:1520,category:'辦公用品',receipt:'無',status:'approved',note:'宇德公司'},
  {id:201,person:'nc',personName:'鄭詩褣',month:'2025-09',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-09-01',item:'月度費用申請（匯總）',amount:397,category:'其他',receipt:'無',status:'approved',note:''},
  {id:202,person:'nc',personName:'鄭詩褣',month:'2025-09',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-09-01',item:'月度費用申請（匯總）',amount:211,category:'水電瓦斯',receipt:'無',status:'approved',note:''},
  {id:203,person:'nc',personName:'鄭詩褣',month:'2025-09',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-09-01',item:'月度費用申請（匯總）',amount:1907,category:'辦公用品',receipt:'無',status:'approved',note:''},
  {id:204,person:'nc',personName:'鄭詩褣',month:'2025-09',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-09-01',item:'月度費用申請（匯總）',amount:1330,category:'郵資',receipt:'無',status:'approved',note:''},
  {id:205,person:'nc',personName:'鄭詩褣',month:'2025-09',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-09-01',item:'月度費用申請（匯總）',amount:140,category:'餐費',receipt:'無',status:'approved',note:''},
  {id:206,person:'nc',personName:'鄭詩褣',month:'2025-08',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-08-01',item:'月度費用申請（匯總）',amount:205,category:'其他',receipt:'無',status:'approved',note:''},
  {id:207,person:'nc',personName:'鄭詩褣',month:'2025-08',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-08-01',item:'月度費用申請（匯總）',amount:954,category:'辦公用品',receipt:'無',status:'approved',note:''},
  {id:208,person:'nc',personName:'鄭詩褣',month:'2025-07',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-07-01',item:'月度費用申請（匯總）',amount:398,category:'其他',receipt:'無',status:'approved',note:''},
  {id:209,person:'nc',personName:'鄭詩褣',month:'2025-07',caseKey:'YT-CHL-2025-001',caseName:'俊林辦公室',date:'2025-07-01',item:'月度費用申請（匯總）',amount:200,category:'工程',receipt:'無',status:'approved',note:''},
  {id:210,person:'nc',personName:'鄭詩褣',month:'2025-07',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-07-01',item:'月度費用申請（匯總）',amount:222,category:'水電瓦斯',receipt:'無',status:'approved',note:''},
  {id:211,person:'nc',personName:'鄭詩褣',month:'2025-07',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-07-01',item:'月度費用申請（匯總）',amount:622,category:'辦公用品',receipt:'無',status:'approved',note:''},
  {id:212,person:'nc',personName:'鄭詩褣',month:'2025-07',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-07-01',item:'月度費用申請（匯總）',amount:100,category:'郵資',receipt:'無',status:'approved',note:''},
  {id:213,person:'nc',personName:'鄭詩褣',month:'2025-06',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-06-01',item:'月度費用申請（匯總）',amount:1820,category:'辦公用品',receipt:'無',status:'approved',note:''},
  {id:214,person:'nc',personName:'鄭詩褣',month:'2025-06',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-06-01',item:'月度費用申請（匯總）',amount:132,category:'郵資',receipt:'無',status:'approved',note:''},
  {id:215,person:'nc',personName:'鄭詩褣',month:'2025-05',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-05-01',item:'月度費用申請（匯總）',amount:7,category:'水電瓦斯',receipt:'無',status:'approved',note:''},
  {id:216,person:'nc',personName:'鄭詩褣',month:'2025-05',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-05-01',item:'月度費用申請（匯總）',amount:1210,category:'辦公用品',receipt:'無',status:'approved',note:''},
  {id:217,person:'nc',personName:'鄭詩褣',month:'2025-05',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-05-01',item:'月度費用申請（匯總）',amount:28,category:'郵資',receipt:'無',status:'approved',note:''},
  {id:218,person:'nc',personName:'鄭詩褣',month:'2025-05',caseKey:'YT-UPY-2025-002',caseName:'上洋鶯歌',date:'2025-05-01',item:'月度費用申請（匯總）',amount:410,category:'餐費',receipt:'無',status:'approved',note:''},
  {id:222,person:'sun',personName:'孫一宣',month:'2025-09',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-09-01',item:'月度費用申請（匯總）',amount:60,category:'郵資',receipt:'無',status:'approved',note:''},
  {id:223,person:'sun',personName:'孫一宣',month:'2025-08',caseKey:'YT-UPY-2025-001',caseName:'上洋嘉義',date:'2025-08-01',item:'月度費用申請（匯總）',amount:44,category:'郵資',receipt:'無',status:'approved',note:''},
  {id:224,person:'sun',personName:'孫一宣',month:'2025-07',caseKey:'YT-SUZ-2025-003',caseName:'南港 Suzuki',date:'2025-07-01',item:'月度費用申請（匯總）',amount:3125,category:'工程',receipt:'無',status:'approved',note:'南港suzuki'},
  {id:225,person:'sun',personName:'孫一宣',month:'2025-07',caseKey:'固定開銷',caseName:'固定開銷',date:'2025-07-01',item:'月度費用申請（匯總）',amount:381,category:'辦公用品',receipt:'無',status:'approved',note:'宇德公司'},
  {id:226,person:'sun',personName:'孫一宣',month:'2025-07',caseKey:'固定開銷',caseName:'固定開銷',date:'2025-07-01',item:'月度費用申請（匯總）',amount:44,category:'郵資',receipt:'無',status:'approved',note:'宇德公司'},
  {id:227,person:'sun',personName:'孫一宣',month:'2025-06',caseKey:'固定開銷',caseName:'固定開銷',date:'2025-06-01',item:'月度費用申請（匯總）',amount:130,category:'辦公用品',receipt:'無',status:'approved',note:'宇德公司'},
  {id:228,person:'sun',personName:'孫一宣',month:'2025-06',caseKey:'固定開銷',caseName:'固定開銷',date:'2025-06-01',item:'月度費用申請（匯總）',amount:60,category:'郵資',receipt:'無',status:'approved',note:'宇德公司'},
];
let EXPENSES = tagCompany(JSON.parse(JSON.stringify(INIT_EXPENSES)));
let expNextId = Math.max(...INIT_EXPENSES.map(r => r.id), 0) + 1;
let expTab_current = 'all';

function expCanManageAll() {
  return ['OWNER','FINANCE','ACCOUNTING'].includes(currentUser.roleCode);
}

// ══════════════════════════════════
// EXPENSE MODULE
// ══════════════════════════════════
function expTab(el, tab) {
  document.querySelectorAll('.exp-tab').forEach(b => { b.classList.remove('btn-primary','active'); b.classList.add('btn-ghost'); });
  el.classList.remove('btn-ghost'); el.classList.add('btn-primary','active');
  expTab_current = tab;
  const isSummary = (tab === 'summary');
  const listEl    = document.getElementById('exp-list-view');
  const sumEl     = document.getElementById('exp-summary-view');
  const statsEl   = document.getElementById('exp-stats');
  if (listEl)  listEl.style.display  = isSummary ? 'none' : '';
  if (sumEl)   sumEl.style.display   = isSummary ? '' : 'none';
  if (statsEl) statsEl.style.display = isSummary ? 'none' : '';
  // 隱藏不需要的篩選器
  ['exp-filter-person','exp-filter-month','exp-filter-case','exp-search'].forEach(id => {
    const el2 = document.getElementById(id);
    if (el2) el2.closest('div.page-toolbar') && (el2.style.display = isSummary ? 'none' : '');
  });
  if (isSummary) { renderExpenseSummary(); }
  else { renderExpense(); }
}

function renderExpenseSummary() {
  const year   = document.getElementById('sum-filter-year')?.value   || '';
  const status = document.getElementById('sum-filter-status')?.value || '';

  // 篩選資料
  const rows = EXPENSES.filter(r => {
    if (!expCanManageAll() && r.person !== currentUser.id) return false;
    if (status && r.status !== status) return false;
    if (year   && !r.month.startsWith(year)) return false;
    return true;
  });

  // ── 1. 個案×人員 pivot ──
  const persons  = USERS.filter(u => rows.some(r => r.person === u.id));
  const caseKeys = [...new Set(rows.map(r => r.caseKey))].sort();
  const pivot = {};
  const caseTotal = {}, personTotal = {};
  for (const r of rows) {
    pivot[r.caseKey] = pivot[r.caseKey] || {};
    pivot[r.caseKey][r.person] = (pivot[r.caseKey][r.person] || 0) + r.amount;
    caseTotal[r.caseKey]  = (caseTotal[r.caseKey]  || 0) + r.amount;
    personTotal[r.person] = (personTotal[r.person] || 0) + r.amount;
  }
  const grandTotal = rows.reduce((s,r) => s + r.amount, 0);

  const fmt = n => n ? '$'+n.toLocaleString('zh-TW') : '—';
  const cell = (v, bold, bg) =>
    `<td style="padding:7px 12px;text-align:right;border-bottom:1px solid var(--border);white-space:nowrap${bold?';font-weight:600':''}${bg?';background:'+bg:''}">${v}</td>`;
  const hcell = (v, center) =>
    `<th style="padding:8px 12px;background:var(--surface2);border-bottom:2px solid var(--border);font-size:11px;font-weight:600;color:var(--text2);white-space:nowrap${center?';text-align:center':';text-align:right'}">${v}</th>`;

  const thead = `<thead><tr>
    ${hcell('個案名稱', true)}
    ${persons.map(u => `<th style="padding:8px 10px;background:var(--surface2);border-bottom:2px solid var(--border);text-align:center">
      <span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:${u.color};color:#111;font-size:10px;font-weight:700;line-height:20px;text-align:center">${u.initial}</span>
      <div style="font-size:10px;color:var(--text2);margin-top:2px">${u.name.slice(1)}</div>
    </th>`).join('')}
    ${hcell('合計', false)}
  </tr></thead>`;

  const sortedCases = caseKeys.sort((a,b) => (caseTotal[b]||0) - (caseTotal[a]||0));
  const tbody = `<tbody>${sortedCases.map(ck => {
    const caseName = rows.find(r => r.caseKey === ck)?.caseName || ck;
    return `<tr onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <td style="padding:7px 14px;border-bottom:1px solid var(--border);font-size:12px;font-weight:500">${caseName}</td>
      ${persons.map(u => cell(fmt(pivot[ck]?.[u.id] || 0), false)).join('')}
      ${cell(fmt(caseTotal[ck]), true, 'var(--surface2)')}
    </tr>`;
  }).join('')}
  <tr style="background:var(--surface3)">
    <td style="padding:8px 14px;font-weight:700;font-size:12px;border-top:2px solid var(--border)">合計</td>
    ${persons.map(u => `<td style="padding:8px 12px;text-align:right;font-weight:700;border-top:2px solid var(--border)">$${(personTotal[u.id]||0).toLocaleString('zh-TW')}</td>`).join('')}
    <td style="padding:8px 12px;text-align:right;font-weight:700;border-top:2px solid var(--border);color:var(--accent)">$${grandTotal.toLocaleString('zh-TW')}</td>
  </tr></tbody>`;

  const pivotEl = document.getElementById('sum-pivot-table');
  if (pivotEl) pivotEl.innerHTML = thead + tbody;
  const subEl = document.getElementById('sum-pivot-subtitle');
  if (subEl) subEl.textContent = `（${status ? ({approved:'已核准',pending:'待審核'}[status]||status) : '全部狀態'}${year ? '・'+year+'年' : ''}，共 ${rows.length} 筆，$${grandTotal.toLocaleString('zh-TW')}）`;

  // ── 2. 類別佔比 ──
  const catTotals = {};
  for (const r of rows) catTotals[r.category] = (catTotals[r.category] || 0) + r.amount;
  const catSorted = Object.entries(catTotals).sort((a,b) => b[1]-a[1]);
  const catColors = {交通費:'#7eb8d4',加油:'#e0b870',停車:'#b8b0a8',餐費:'#6eb894',交際費:'#b894e0',工程:'#c8a96e',辦公用品:'#7eb8d4',電話網路訂閱費:'#6eb894',雜支:'#e07070',其他:'#9a9590'};
  const catEl = document.getElementById('sum-cat-chart');
  if (catEl) catEl.innerHTML = catSorted.length === 0 ? '<div style="color:var(--text3);font-size:12px;padding:8px 0">無資料</div>' :
    catSorted.map(([cat, amt]) => {
      const pct = grandTotal ? (amt/grandTotal*100).toFixed(1) : 0;
      const color = catColors[cat] || '#9a9590';
      return `<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:12px;font-weight:500">${cat}</span>
          <span style="font-size:12px;font-family:'DM Mono',monospace;color:var(--text2)">$${amt.toLocaleString('zh-TW')} <span style="color:var(--text3);font-size:11px">(${pct}%)</span></span>
        </div>
        <div style="height:6px;background:var(--surface3);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width 0.4s ease"></div>
        </div>
      </div>`;
    }).join('');
}

function expMonthLabel(month) {
  const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return month || '';
  return `${match[1]}年${Number(match[2])}月`;
}

function expDefaultMonthOptions() {
  const months = new Set();
  const now = new Date();
  const year = Number.isFinite(now.getFullYear()) ? now.getFullYear() : 2026;
  const currentMonth = Number.isFinite(now.getMonth()) ? now.getMonth() + 1 : 12;
  for (let m = currentMonth; m >= 1; m--) {
    months.add(`${year}-${String(m).padStart(2, '0')}`);
  }
  ohAddFutureMonths(months, `${year}-${String(currentMonth).padStart(2, '0')}`, 3);
  return [...months];
}

function expRefreshMonthOptions() {
  const sel = document.getElementById('exp-filter-month');
  if (!sel) return;
  const current = sel.value || '';
  const months = [...new Set([
    ...expDefaultMonthOptions(),
    ...EXPENSES
    .filter(r => expCanManageAll() || r.person === currentUser.id)
    .map(r => r.month)
    .filter(month => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || '')))
  ])]
    .sort((a,b) => b.localeCompare(a));
  sel.innerHTML = `<option value="">所有月份</option>` + months
    .map(month => `<option value="${month}">${expMonthLabel(month)}</option>`)
    .join('');
  sel.value = (!current || months.includes(current)) ? current : '';
}

function expRefreshPersonFilterOptions() {
  const sel = document.getElementById('exp-filter-person');
  if (!sel) return;
  const current = sel.value || '';
  fillActiveUserSelect('exp-filter-person', current, { allLabel:'所有人員' });
}

function expRefreshBatchPersonOptions(selectedId = currentUser.id, options = {}) {
  fillActiveUserSelect('exp-batch-person', selectedId, { includeInactive:!!options.includeInactive });
}

function renderExpense() {
  const canApprove = expCanManageAll();
  const personFilterEl = document.getElementById('exp-filter-person');
  if (personFilterEl) {
    expRefreshPersonFilterOptions();
    personFilterEl.style.display = canApprove ? '' : 'none';
    if (!canApprove) personFilterEl.value = currentUser.id;
  }
  expRefreshMonthOptions();
  const filterPerson = canApprove ? (personFilterEl?.value || '') : currentUser.id;
  const filterMonth  = document.getElementById('exp-filter-month')?.value  || '';
  const filterCase   = normalizeCaseFilterValue(document.getElementById('exp-filter-case')?.value   || '');
  const kw = (document.getElementById('exp-search')?.value || '').toLowerCase();
  const rows = sortOpsRows(EXPENSES.filter(r => {
    if (expTab_current !== 'all' && r.status !== expTab_current) return false;
    if (filterPerson && r.person !== filterPerson) return false;
    if (filterMonth  && r.month  !== filterMonth)  return false;
    if (filterCase   && r.caseKey !== filterCase)  return false;
    if (!canApprove && r.person !== currentUser.id) return false;
    if (r.caseKey && r.caseKey !== '固定開銷' && !userCanViewCaseFinancials(r.caseKey, 'expense')) return false;
    if (kw && !`${r.item} ${r.category} ${r.caseName} ${r.caseKey}`.toLowerCase().includes(kw)) return false;
    return true;
  }), 'date-desc', r => r.date, r => r.item, r => r.amount);
  // 沒篩選單一人員時，先依人員（跟人員下拉選單同一套順序）分開群組，組內沿用上面已經排好的日期新到舊
  const expPersonOrder = USERS.map(u => u.id);
  const expPersonRank = p => { const i = expPersonOrder.indexOf(p); return i < 0 ? expPersonOrder.length : i; };
  rows.sort((a,b) => expPersonRank(a.person) - expPersonRank(b.person));
  const stLbl = {pending:'待審核', approved:'已核准', rejected:'已退回'};
  const stCls = {pending:'tag-pending', approved:'tag-done', rejected:'tag-inactive'};
  const catColor = {交通費:'#7eb8d4',加油:'#e0b870',停車:'#9a9590',餐費:'#6eb894',交際費:'#b894e0',工程:'#c8a96e',辦公用品:'#7eb8d4',電話網路訂閱費:'#6eb894',雜支:'#e07070',其他:'#9a9590'};
  const tbody = document.getElementById('exp-tbody');
  if (!tbody) return;
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:32px;color:var(--text3)">無資料</td></tr>`;
  } else {
    tbody.innerHTML = rows.map((r,i) => `
      <tr style="border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
        <td style="padding:8px 14px;color:var(--text3);font-size:11px">${String(i+1).padStart(3,'0')}</td>
        <td style="padding:8px 14px;font-size:12px;white-space:nowrap">
          <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${USERS.find(u=>u.id===r.person)?.color||'#555'};color:#111;font-size:10px;font-weight:700;text-align:center;line-height:22px;margin-right:5px">${USERS.find(u=>u.id===r.person)?.initial||'？'}</span>
          ${r.personName}
        </td>
        <td style="padding:8px 14px;font-size:11px;color:var(--text2);font-family:'DM Mono',monospace">${r.month}</td>
        <td style="padding:8px 14px;font-size:12px;color:var(--text2)">${r.caseName}
          ${r.postCloseTreatment ? `<div style="margin-top:3px;font-size:10px;color:${r.postCloseTreatment==='post_close_cost'?'var(--warning)':'var(--text3)'}">${r.postCloseTreatment==='post_close_cost'?'結案後補成本':'公司吸收'}</div>` : ''}
        </td>
        <td style="padding:8px 14px;font-size:12px">${r.date}</td>
        <td style="padding:8px 14px;font-size:12px;max-width:200px">${r.item}</td>
        <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-weight:600">$${r.amount.toLocaleString('zh-TW')}</td>
        <td style="padding:8px 10px;font-size:11px"><span class="tag" style="background:var(--surface3);color:var(--text2)">${r.category}</span></td>
        <td style="padding:8px 10px;font-size:11px;color:var(--text2)">${r.receipt}</td>
        <td style="padding:6px 10px;min-width:100px">
          <input type="text" value="${r.note||''}" placeholder="備註…"
            style="background:transparent;border:none;outline:none;width:100%;font-size:11px;color:var(--text2);padding:3px 5px;border-radius:4px"
            onfocus="this.style.background='var(--surface2)';this.style.border='1px solid var(--border)'"
            onblur="this.style.background='transparent';this.style.border='none';expUpdateNote(${r.id},this.value)"
            onkeydown="if(event.key==='Enter')this.blur()">
        </td>
        <td style="padding:8px 14px"><span class="tag ${stCls[r.status]||'tag-pending'}">${stLbl[r.status]||r.status}</span></td>
        <td style="padding:8px 10px;white-space:nowrap">${expenseRowActions(r)}</td>
      </tr>`).join('');
  }
  updateExpenseStats(rows);
}

function expCanEditRow(r) {
  return !!r && (expCanManageAll() || (r.person === currentUser.id && ['pending','rejected'].includes(r.status)));
}

function expenseRowActions(r) {
  const actions = [];
  if (expCanManageAll() && r.status === 'pending') {
    actions.push(`<button class="btn btn-ghost btn-sm" style="font-size:10px;color:var(--success)" onclick="approveExpense(${r.id})">核准</button>`);
    actions.push(`<button class="btn btn-ghost btn-sm" style="font-size:10px;color:var(--error)" onclick="rejectExpense(${r.id})">退回</button>`);
  }
  if (expCanEditRow(r)) {
    actions.push(`<button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="editExpense(${r.id})">修改</button>`);
    actions.push(`<button class="btn btn-ghost btn-sm" style="font-size:10px;color:var(--error)" onclick="deleteExpense(${r.id})">刪除</button>`);
  }
  return actions.length ? actions.join('') : '<span style="font-size:11px;color:var(--text3)">—</span>';
}

function updateExpenseStats(rowsForStats) {
  const thisMonth = currentMonthKey();
  const selectedMonth = document.getElementById('exp-filter-month')?.value || '';
  const month = selectedMonth || thisMonth;
  const mRows = Array.isArray(rowsForStats)
    ? rowsForStats
    : EXPENSES.filter(r => r.month === month && (expCanManageAll() || r.person === currentUser.id));
  const sum = (arr,s) => arr.filter(r=>r.status===s).reduce((t,r)=>t+r.amount,0);
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  const scopeLabel = selectedMonth ? expMonthLabel(selectedMonth) : '目前篩選';
  set('exp-stat-pending-label', `${scopeLabel}待審核`);
  set('exp-stat-approved-label', `${scopeLabel}已核准`);
  set('exp-stat-count-label', `${scopeLabel}申請筆數`);
  set('exp-stat-total-label', `${scopeLabel}合計`);
  set('exp-stat-pending-amt',  '$'+sum(mRows,'pending').toLocaleString('zh-TW'));
  set('exp-stat-approved-amt', '$'+sum(mRows,'approved').toLocaleString('zh-TW'));
  set('exp-stat-count', mRows.length+' 筆');
  set('exp-stat-total', '$'+mRows.reduce((t,r)=>t+r.amount,0).toLocaleString('zh-TW'));
  const badge = document.getElementById('badge-expense');
  const pendingAll = EXPENSES.filter(r=>r.status==='pending' && (expCanManageAll() || r.person === currentUser.id)).length;
  if (badge) badge.textContent = pendingAll > 0 ? pendingAll : '';
}

function approveExpense(id) {
  if (!expCanManageAll()) { showToast('您沒有核准費用的權限','error'); return; }
  const r = EXPENSES.find(x=>x.id===id);
  if (r) { r.status='approved'; expReapplyExpenseEffects(r); renderExpense(); renderOverhead(); renderProfit(); renderProfitShare(); saveData(); showToast('已核准費用申請 ✓','success'); }
}
function rejectExpense(id) {
  if (!expCanManageAll()) { showToast('您沒有退回費用的權限','error'); return; }
  const r = EXPENSES.find(x=>x.id===id);
  if (r) { r.status='rejected'; renderExpense(); saveData(); showToast('已退回費用申請','error'); }
}
function editExpense(id) {
  const r = EXPENSES.find(x=>x.id===id);
  if (!expCanEditRow(r)) { showToast('這筆費用不能修改','error'); return; }
  expBatchInitEdit(id);
}
function deleteExpense(id) {
  const idx = EXPENSES.findIndex(x=>x.id===id);
  const r = EXPENSES[idx];
  if (!expCanEditRow(r)) { showToast('這筆費用不能刪除','error'); return; }
  if (!confirm(`確定刪除這筆費用？\n${r.caseName || ''}｜${r.item || ''}｜$${(r.amount || 0).toLocaleString('zh-TW')}`)) return;
  expRemoveLinkedOverhead(r);
  EXPENSES.splice(idx, 1);
  renderExpense(); renderOverhead(); renderProfit(); renderProfitShare();
  saveData();
  showToast('費用已刪除','success');
}
function expUpdateNote(id,val) {
  const r = EXPENSES.find(x=>x.id===id);
  if (!r || (!expCanManageAll() && r.person !== currentUser.id)) return;
  r.note=val; saveData();
}

const EXP_CASES = [
  {key:'固定開銷',        name:'固定開銷'},
  // ── 凱銳集團 ──
  {key:'YT-SUZ-2025-001', name:'木柵 Suzuki'},
  {key:'YT-SUZ-2025-002', name:'民族 Suzuki 服務廠'},
  {key:'YT-SUZ-2025-003', name:'南港 Suzuki'},
  {key:'YT-KYG-2025-001', name:'凱揚濱江'},
  {key:'YT-KYG-2025-002', name:'濱江凱揚'},
  {key:'YT-JET-2025-001', name:'凱銳嘉義'},
  {key:'YT-VOL-2025-001', name:'林口三井'},
  {key:'YT-VOL-2025-002', name:'中和Volvo會議室'},
  // ── 上洋集團 ──
  {key:'YT-UPY-2025-001', name:'上洋嘉義'},
  {key:'YT-UPY-2025-002', name:'上洋鶯歌'},
  {key:'YT-UPY-2026-001', name:'上洋高雄'},
  // ── 其他客戶 ──
  {key:'YT-WWF-2025-001', name:'文威豐'},
  {key:'YT-CHL-2025-001', name:'俊林辦公室'},
  // ── 未來案件 ──
  {key:'YT-ZHG-2025-001', name:'板橋張總15F'},
  {key:'YT-LIN-2026-001', name:'板橋林協理'},
  {key:'YT-ATG-2026-001', name:'板橋安庭'},
  {key:'YT-UNI-2026-001', name:'UNI MUSIC'},
];
const EXP_CATS     = ['交通費','加油','停車','餐費','交際費','工程','辦公用品','電話網路/訂閱費','住宿','郵資','水電瓦斯','雜支','其他'];
const EXP_RECEIPTS = ['發票','收據','車票','無'];
const _CS = 'background:var(--surface2);border:1px solid var(--border2);border-radius:6px;padding:4px 6px;font-size:12px;color:var(--text);width:100%';
function parseMoneyInput(value) {
  const cleaned = String(value || '').replace(/,/g, '').replace(/[^\d.\-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function expBatchCaseOptions() {
  return [
    {key:'固定開銷', name:'固定開銷'},
    ...CASES
      .filter(expIsSelectableCase)
      .sort(psCaseNameSort)
      .map(c => ({key:c.code, name:c.name, status:c.status})),
  ];
}

function expIsSelectableCase(c) {
  return !!c && userCanViewCaseFinancials(c.code, 'expense');
}

function expBatchCaseLabel(c) {
  const closed = c.status === '結案' ? '（已結案）' : '';
  return c.key === c.name ? c.key : `${c.name}${closed}｜${c.key}`;
}

function expResolveBatchCase(input) {
  const raw = String(input?.value || '').trim();
  const options = expBatchCaseOptions();
  if (!raw) return options[0];
  return options.find(c => c.key === raw || c.name === raw || expBatchCaseLabel(c) === raw)
    || options.find(c => raw && (expBatchCaseLabel(c).includes(raw) || raw.includes(c.key) || raw.includes(c.name.replace('（已結案）',''))))
    || null;
}

function expRefreshBatchCaseDatalist() {
  const dl = document.getElementById('dl-exp-batch-cases');
  if (!dl) return;
  dl.innerHTML = expBatchCaseOptions().map(c => `<option value="${expBatchCaseLabel(c)}"></option>`).join('');
}

function expPostCloseShares(caseCode, amount) {
  const c = CASES.find(x => x.code === caseCode);
  const ratios = c ? psGetSplitRatio(c) : {};
  return Object.fromEntries(Object.entries(ratios).filter(([,ratio]) => ratio > 0).map(([person,ratio]) => [person, amount * ratio]));
}

function expFinalizePostClose(row) {
  if (!row || row.status !== 'approved') return;
  if (row.postCloseTreatment === 'post_close_cost') {
    row.profitAdjustmentShares = row.profitAdjustmentShares || expPostCloseShares(row.caseKey, row.amount || 0);
    row.profitAdjustmentApplied = row.profitAdjustmentApplied || {};
  }
  if (row.postCloseTreatment === 'company_absorb') {
    if (!OVERHEAD[row.month]) ohInitMonth(row.month);
    const vars = OVERHEAD[row.month].variable || (OVERHEAD[row.month].variable = []);
    if (!vars.some(v => v.sourceExpenseId === row.id)) {
      vars.push({
        id: ohVarNextId++, name:`結案後公司吸收｜${row.caseName}｜${row.item}`,
        amount:row.amount || 0, note:row.note || '', sourceExpenseId:row.id,
        postClosePending:true, postCloseSettled:false, companyId:COMPANY_ID
      });
    }
  }
}

function expRemoveLinkedOverhead(row) {
  if (!row || !OVERHEAD) return;
  Object.values(OVERHEAD).forEach(monthData => {
    if (!monthData || !Array.isArray(monthData.variable)) return;
    monthData.variable = monthData.variable.filter(v => v.sourceExpenseId !== row.id);
  });
}

function expReapplyExpenseEffects(row) {
  expRemoveLinkedOverhead(row);
  delete row.profitAdjustmentShares;
  delete row.profitAdjustmentApplied;
  expFinalizePostClose(row);
}

function expBatchCaseChanged(select) {
  const tr = select.closest('tr');
  const treatment = tr?.querySelector('.exp-post-close-treatment');
  if (!treatment) return;
  const resolved = expResolveBatchCase(select);
  if (resolved) select.dataset.caseKey = resolved.key;
  else select.dataset.caseKey = '';
  const closed = resolved ? isClosedCase(resolved.key) : false;
  treatment.disabled = !closed;
  // 修改既有費用時不要用「案子現在是否結案」硬蓋掉處理方式：這筆費用可能本來就是結案前的
  // 正常費用，只是案子後來才結案，使用者只是要修正日期之類的小地方，不該被迫或被悄悄
  // 改成「結案後補成本」而誤扣到分潤。新增列（非編輯模式）才維持原本「結案就預設要選」的行為。
  if (closed && expBatchEditId === null) treatment.value = treatment.value || 'post_close_cost';
  else if (!closed) treatment.value = '';
  treatment.style.opacity = closed ? '1' : '.55';
}

function expBatchCasePickerMouseDown(input) {
  if (!input || !String(input.value || '').trim()) return;
  input.value = '';
  input.dataset.caseKey = '固定開銷';
  expBatchCaseChanged(input);
}

let _batchN = 0;
let expBatchEditId = null;

function expBatchClose() {
  expBatchEditId = null;
  const t = document.getElementById('exp-batch-modal-title');
  if (t) t.textContent = '月份費用批次申請';
  const b = document.getElementById('exp-batch-submit-btn');
  if (b) b.textContent = '送出申請';
  closeModal('modal-add-expense');
}

function expBatchInitEdit(id) {
  const r = EXPENSES.find(x => x.id === id);
  if (!r) return;
  expBatchEditId = id;
  _batchN = 0;
  const tbody = document.getElementById('exp-batch-tbody');
  if (tbody) tbody.innerHTML = '';
  expRefreshBatchCaseDatalist();
  const mEl = document.getElementById('exp-batch-month');
  if (mEl) { mEl.value = r.month || ''; mEl.disabled = false; }
  expRefreshBatchPersonOptions(r.person || currentUser.id, { includeInactive:true });
  const personEl = document.getElementById('exp-batch-person');
  if (personEl) { personEl.value = r.person || currentUser.id; personEl.disabled = true; personEl.style.opacity = '.75'; }
  expBatchAddRow(false);
  const t = document.getElementById('exp-batch-modal-title');
  if (t) t.textContent = '修改費用申請';
  const b = document.getElementById('exp-batch-submit-btn');
  if (b) b.textContent = '儲存修改';
  // Pre-fill the single row
  setTimeout(() => {
    const tr = document.querySelector('#exp-batch-tbody tr');
    if (!tr) return;
    const ins = tr.querySelectorAll('input,select');
    const caseEl=ins[0], treatmentEl=ins[1], dateEl=ins[2], itemEl=ins[3], amtEl=ins[4], catEl=ins[5], recEl=ins[6], noteEl=ins[7];
    if (caseEl) { caseEl.value = r.caseName || r.caseKey || '固定開銷'; expBatchCaseChanged(caseEl); }
    if (treatmentEl && r.postCloseTreatment) { treatmentEl.value = r.postCloseTreatment; treatmentEl.disabled = false; treatmentEl.style.opacity = '1'; }
    if (dateEl) dateEl.value = r.date || (r.month + '-01');
    if (itemEl) itemEl.value = r.item || '';
    if (amtEl)  amtEl.value = r.amount || 0;
    if (catEl)  catEl.value = r.category || catEl.options[0]?.value || '';
    if (recEl)  recEl.value = r.receipt || recEl.options[0]?.value || '';
    if (noteEl) noteEl.value = r.note || '';
  }, 50);
  openModal('modal-add-expense');
}

function expBatchAddRow(focusNew) {
  const id = ++_batchN;
  const tbody = document.getElementById('exp-batch-tbody');
  const idx   = tbody.querySelectorAll('tr').length + 1;
  const month = document.getElementById('exp-batch-month')?.value || '';
  const dateDef = month ? month+'-01' : '';
  expRefreshBatchCaseDatalist();
  const treatmentOpts = `<option value="">一般費用</option><option value="post_close_cost">結案後補成本</option><option value="company_absorb">公司吸收</option>`;
  const catOpts  = EXP_CATS.map(c=>`<option>${c}</option>`).join('');
  const recOpts  = EXP_RECEIPTS.map(c=>`<option>${c}</option>`).join('');
  const tr = document.createElement('tr');
  tr.id = 'ebr-'+id;
  tr.style.borderBottom = '1px solid var(--border)';
  tr.innerHTML = `
    <td style="padding:4px 5px;text-align:center;font-size:11px;color:var(--text3)">${idx}</td>
    <td style="padding:4px 4px"><input type="text" list="dl-exp-batch-cases" data-case-key="固定開銷" value="" style="${_CS}" placeholder="固定開銷／輸入案名或代碼" title="再次點擊可清除並重新選擇" onmousedown="expBatchCasePickerMouseDown(this)" oninput="expBatchCaseChanged(this)" onchange="expBatchCaseChanged(this)"></td>
    <td style="padding:4px 4px"><select class="exp-post-close-treatment" style="${_CS};opacity:.55" disabled>${treatmentOpts}</select></td>
    <td style="padding:4px 4px"><input type="date" style="${_CS}" value="${dateDef}"></td>
    <td style="padding:4px 4px"><input type="text" style="${_CS}" placeholder="付款項目（必填）"></td>
    <td style="padding:4px 4px"><input type="number" style="${_CS};text-align:right" placeholder="0" min="0"></td>
    <td style="padding:4px 4px"><select style="${_CS}">${catOpts}</select></td>
    <td style="padding:4px 4px"><select style="${_CS}">${recOpts}</select></td>
    <td style="padding:4px 4px"><input type="text" style="${_CS}" placeholder="備註"></td>
    <td style="padding:4px 3px;text-align:center">
      <button onclick="this.closest('tr').remove();expBatchRenum()" title="刪除"
        style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:15px;padding:1px 4px;line-height:1">×</button>
    </td>`;
  tbody.appendChild(tr);
  if (focusNew !== false) {
    const inp = tr.querySelector('select,input');
    if (inp) setTimeout(()=>inp.focus(), 30);
  }
}
function expBatchRenum() {
  document.querySelectorAll('#exp-batch-tbody tr').forEach((tr,i)=>{
    const td = tr.querySelector('td');
    if (td) td.textContent = i+1;
  });
}
// ── 複製上月固定開銷項目 ──
function expBatchCopyLastMonth() {
  const person = document.getElementById('exp-batch-person').value;
  const month  = document.getElementById('exp-batch-month').value;
  if (!month) { showToast('請先選擇月份','error'); return; }
  const [y,m] = month.split('-').map(Number);
  const prevDate = new Date(y, m-2, 1);
  const prevMonth = prevDate.getFullYear()+'-'+String(prevDate.getMonth()+1).padStart(2,'0');
  const prevRows = EXPENSES.filter(e => e.person===person && e.month===prevMonth && e.caseKey==='固定開銷');
  if (!prevRows.length) { showToast(`找不到 ${prevMonth} 的固定開銷項目`,'error'); return; }
  prevRows.forEach(r => {
    expBatchAddRow(false);
    const tr = document.querySelector('#exp-batch-tbody tr:last-child');
    const ins = tr.querySelectorAll('input,select');
    ins[0].value = '固定開銷';
    expBatchCaseChanged(ins[0]);
    const day = (r.date && r.date.length>=10) ? r.date.slice(8,10) : '01';
    ins[2].value = `${month}-${day}`;
    ins[3].value = r.item;
    ins[4].value = r.amount;
    if ([...ins[5].options].some(o=>o.value===r.category)) ins[5].value = r.category;
    if ([...ins[6].options].some(o=>o.value===r.receipt)) ins[6].value = r.receipt;
    ins[7].value = r.note || '';
  });
  showToast(`已複製 ${prevRows.length} 筆固定開銷項目，請確認金額`,'success');
}

// ── 從試算表貼上整段資料，依欄位自動分列填入 ──
function expBatchSetSelect(sel, val) {
  if (!val) return;
  if (sel.matches?.('input[list="dl-exp-batch-cases"]')) {
    const opt = expBatchCaseOptions().find(o =>
      o.key === val || o.name === val || expBatchCaseLabel(o) === val ||
      expBatchCaseLabel(o).includes(val) || val.includes(o.key) || val.includes(o.name.replace('（已結案）',''))
    );
    sel.value = opt ? expBatchCaseLabel(opt) : val;
    expBatchCaseChanged(sel);
    return;
  }
  const opts = [...sel.options];
  let opt = opts.find(o => o.text.trim() === val || o.value === val);
  if (!opt) opt = opts.find(o => o.text.includes(val) || val.includes(o.text));
  if (!opt && val.includes('固定')) opt = opts.find(o => o.value === '固定開銷');
  if (opt) sel.value = opt.value;
}
function expBatchParseDate(val, month) {
  if (!val) return '';
  let mm = val.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (mm) return `${mm[1]}-${mm[2].padStart(2,'0')}-${mm[3].padStart(2,'0')}`;
  mm = val.match(/^(\d{1,2})[\/-](\d{1,2})$/);
  if (mm && month) return `${month}-${mm[1].padStart(2,'0')}-${mm[2].padStart(2,'0')}`;
  return '';
}
document.addEventListener('paste', function(e) {
  const target = e.target;
  if (!target.closest || !target.closest('#exp-batch-tbody')) return;
  const text = (e.clipboardData || window.clipboardData).getData('text');
  if (!text || (!text.includes('\t') && !text.includes('\n'))) return;
  e.preventDefault();
  const month = document.getElementById('exp-batch-month')?.value || '';
  const tr0 = target.closest('tr');
  let allRows = [...document.querySelectorAll('#exp-batch-tbody tr')];
  const rowIdx = allRows.indexOf(tr0);
  const ins0 = [...tr0.querySelectorAll('input,select')];
  const colIdx = ins0.indexOf(target);
  const rows = text.replace(/\r/g,'').split('\n').filter(r => r.length);
  rows.forEach((rowText, ri) => {
    allRows = [...document.querySelectorAll('#exp-batch-tbody tr')];
    let tr = allRows[rowIdx+ri];
    if (!tr) { expBatchAddRow(false); tr = document.querySelector('#exp-batch-tbody tr:last-child'); }
    const ins = [...tr.querySelectorAll('input,select')];
    rowText.split('\t').forEach((val, ci) => {
      const cell = ins[colIdx+ci];
      if (!cell) return;
      val = val.trim();
      if (cell.tagName === 'SELECT') expBatchSetSelect(cell, val);
      else if (cell.type === 'date') cell.value = expBatchParseDate(val, month) || cell.value;
      else if (cell.type === 'number') cell.value = val.replace(/[^0-9.\-]/g,'');
      else cell.value = val;
    });
    expBatchCaseChanged(ins[0]);
  });
  showToast('已貼上資料','success');
});
// ── 月份變更時，將仍為「上次預設日期」的列同步更新為新月份第一天 ──
function expBatchMonthChanged() {
  const month = document.getElementById('exp-batch-month')?.value || '';
  if (!month) return;
  document.querySelectorAll('#exp-batch-tbody tr').forEach(tr => {
    const dateEl = tr.querySelectorAll('input,select')[2];
    if (!dateEl) return;
    if (expBatchEditId !== null) {
      // 修改模式：保留原本的「日」，只把年－月換成新選的月份
      const day = (dateEl.value && dateEl.value.length >= 10) ? dateEl.value.slice(8,10) : '01';
      dateEl.value = `${month}-${day}`;
    } else if (/^\d{4}-\d{2}-01$/.test(dateEl.value)) {
      dateEl.value = month+'-01';
    }
  });
}
function expBatchInit() {
  _batchN = 0;
  const tbody = document.getElementById('exp-batch-tbody');
  if (tbody) tbody.innerHTML = '';
  expRefreshBatchCaseDatalist();
  const mEl = document.getElementById('exp-batch-month');
  if (mEl) mEl.value = currentMonthKey();
  expRefreshBatchPersonOptions(currentUser.id);
  const personEl = document.getElementById('exp-batch-person');
  if (personEl) {
    personEl.value = currentUser.id;
    personEl.disabled = !expCanManageAll();
    personEl.style.opacity = expCanManageAll() ? '1' : '.75';
  }
  for (let i=0; i<6; i++) expBatchAddRow(false);
}
function submitBatchExpense() {
  const selectedPerson = document.getElementById('exp-batch-person').value;
  const person = expCanManageAll() ? selectedPerson : currentUser.id;
  const month  = document.getElementById('exp-batch-month').value;
  if (!month) { showToast('請選擇月份','error'); return; }
  const user   = systemUserById(person) || USERS[0];
  const status = 'pending';
  let errMsg = '';
  const pendingRows = [];
  // 只有「新增」列會強制要求選結案後處理方式；編輯既有費用時完全尊重下拉選單目前的值
  // （包含選回「一般費用」），不再強迫分類。原因：案子現在是否結案，跟這筆費用當初是不是
  // 結案前的正常費用無關，硬性要求會讓使用者為了改個日期之類的小地方，被迫（或先前版本裡
  // 被悄悄預設）誤標成「結案後補成本」而錯扣到分潤；也讓已經被誤標過的舊資料，能在編輯時
  // explicit 選回「一般費用」自行修正，不會被擋。
  document.querySelectorAll('#exp-batch-tbody tr').forEach((tr,i)=>{
    const ins = tr.querySelectorAll('input,select');
    const caseEl=ins[0], treatmentEl=ins[1], dateEl=ins[2], itemEl=ins[3], amtEl=ins[4], catEl=ins[5], recEl=ins[6], noteEl=ins[7];
    const caseInfo = expResolveBatchCase(caseEl);
    const item = itemEl.value.trim();
    const amtV = amtEl.value.trim();
    if (!item && !amtV) return;
    if (!caseInfo) { if(!errMsg) errMsg=`第 ${i+1} 列：請選擇有效的歸屬個案`; return; }
    if (!item)  { if(!errMsg) errMsg=`第 ${i+1} 列：請填付款項目`; return; }
    if (!amtV)  { if(!errMsg) errMsg=`第 ${i+1} 列：請填金額`; return; }
    const isClosed = caseInfo.key !== '固定開銷' && isClosedCase(caseInfo.key);
    const requireTreatment = isClosed && expBatchEditId === null;
    const postCloseTreatment = requireTreatment ? (treatmentEl.value || 'post_close_cost') : (['post_close_cost','company_absorb'].includes(treatmentEl.value) ? treatmentEl.value : '');
    if (requireTreatment && !['post_close_cost','company_absorb'].includes(postCloseTreatment)) {
      if (!errMsg) errMsg=`第 ${i+1} 列：請選擇結案後處理方式`;
      return;
    }
    pendingRows.push({
      person, personName: user.name, month,
      caseKey: caseInfo.key, caseName: caseInfo.name,
      date: dateEl.value || month+'-01',
      item, amount: parseMoneyInput(amtV),
      category: catEl.value, receipt: recEl.value, status,
      postCloseTreatment,
      note: noteEl.value.trim(),
    });
  });
  if (errMsg) { showToast(errMsg,'error'); return; }
  if (!pendingRows.length) { showToast('請至少填寫一列費用','error'); return; }
  if (expBatchEditId !== null) {
    const r = EXPENSES.find(x => x.id === expBatchEditId);
    if (r) {
      const row = pendingRows[0];
      expRemoveLinkedOverhead(r);
      Object.assign(r, {
        month: row.month,
        caseKey: row.caseKey, caseName: row.caseName,
        date: row.date, item: row.item, amount: row.amount,
        category: row.category, receipt: row.receipt,
        postCloseTreatment: row.postCloseTreatment,
        note: row.note,
      });
      if (!expCanManageAll() && r.status === 'rejected') r.status = 'pending';
      delete r.profitAdjustmentShares;
      delete r.profitAdjustmentApplied;
      if (r.status === 'approved') expReapplyExpenseEffects(r);
    }
    expBatchClose();
    renderExpense(); renderOverhead(); renderProfit(); renderProfitShare();
    saveData();
    showToast('費用已更新 ✓','success');
    return;
  }
  pendingRows.forEach(row => {
    const saved = { id: expNextId++, ...row };
    EXPENSES.push(saved);
  });
  expBatchClose();
  renderExpense(); renderOverhead(); renderProfit(); renderProfitShare();
  saveData();
  showToast(`已送出 ${pendingRows.length} 筆費用申請 ✓`,'success');
}
