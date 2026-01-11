# Análise de Segurança - App Caminho Seguro
## Melhorias Recomendadas para Relatos

---

## 🎯 ANÁLISE DO CÓDIGO ATUAL

### ✅ Pontos Fortes Existentes

1. **Rate Limiting Implementado**
   - 10 relatos/hora por IP
   - 5 relatos/dia por usuário
   - 50 verificações/hora

2. **Sanitização de Conteúdo**
   - Remoção de HTML com `sanitize-html`
   - Limite de 1000 caracteres

3. **Ofuscação de Localização**
   - Offset de ±50m nas coordenadas

4. **Anonimização**
   - `userId` removido nas respostas da API

5. **Estrutura de Denúncias**
   - Tabela `reportFlags` para relatos falsos
   - Sistema de upvote/downvote

---

## 🔴 VULNERABILIDADES IDENTIFICADAS

### 1. **Falta de Validação Geográfica**
**Problema:** Usuário pode criar relatos em locais impossíveis fisicamente
```typescript
// ATUAL: Não há validação de deslocamento
await storage.createReport({...});
```

**Impacto:** Ataques Sybil com relatos falsos em massa

---

### 2. **Ausência de Sistema de Reputação**
**Problema:** Todos os usuários têm o mesmo peso, independente do histórico
```typescript
// ATUAL: Todos os relatos têm mesmo peso
verifiedCount: 0  // Não considera reputação do criador
```

**Impacto:** Usuários maliciosos podem criar múltiplas contas

---

### 3. **Delay de 30 Minutos Muito Alto**
**Problema:** Relatos demoram para aparecer no mapa
```typescript
// routes.ts linha 78
const reports = await storage.getReports(10); // delay de apenas 10ms em testes
```

**Impacto:** Informações de segurança não chegam em tempo real

---

### 4. **Falta de Detecção de Duplicatas**
**Problema:** Mesmo usuário pode criar relatos idênticos
```typescript
// Não há verificação de duplicatas antes de criar
const report = await storage.createReport({...});
```

**Impacto:** Spam e manipulação de áreas

---

### 5. **Sem Validação de Telefone**
**Problema:** Qualquer email pode criar conta
```typescript
// auth.ts: Apenas email é usado
email: varchar("email").unique()
```

**Impacto:** Fácil criar múltiplas contas falsas

---

### 6. **Downvotes Não Ocultam Relatos**
**Problema:** Relatos com muitos downvotes continuam visíveis
```typescript
// Apenas incrementa contador, não remove
downvoteCount: sql`${reports.downvoteCount} + 1`
```

**Impacto:** Relatos falsos permanecem no mapa

---

## 🛡️ MELHORIAS RECOMENDADAS (PRIORIDADE)

### **FASE 1 - CRÍTICA (Implementar Primeiro)**

#### 1.1. Sistema de Reputação de Usuários

**Criar tabela de reputação:**
```sql
-- migrations/add_user_reputation.sql
CREATE TABLE user_reputation (
  user_id VARCHAR PRIMARY KEY REFERENCES users(id),
  score INTEGER DEFAULT 100,
  reports_created INTEGER DEFAULT 0,
  reports_verified INTEGER DEFAULT 0,
  reports_flagged INTEGER DEFAULT 0,
  account_age_days INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_reputation_score ON user_reputation(score);
```

**Schema TypeScript:**
```typescript
// shared/schema.ts
export const userReputation = pgTable("user_reputation", {
  userId: varchar("user_id").primaryKey(),
  score: integer("score").default(100),
  reportsCreated: integer("reports_created").default(0),
  reportsVerified: integer("reports_verified").default(0),
  reportsFlagged: integer("reports_flagged").default(0),
  accountAgeDays: integer("account_age_days").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});
```

**Função de cálculo:**
```typescript
// server/reputation.ts
export class ReputationSystem {
  async calculateScore(userId: string): Promise<number> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!user.length) return 0;
    
    const reputation = await db
      .select()
      .from(userReputation)
      .where(eq(userReputation.userId, userId))
      .limit(1);
    
    if (!reputation.length) {
      // Criar reputação inicial
      await db.insert(userReputation).values({ userId });
      return 100; // Score inicial
    }
    
    const rep = reputation[0];
    let score = 100;
    
    // +5 por cada relato verificado por outros
    score += rep.reportsVerified * 5;
    
    // -20 por cada relato denunciado e confirmado como falso
    score -= rep.reportsFlagged * 20;
    
    // +1 por cada dia de conta (máx 30 dias)
    score += Math.min(rep.accountAgeDays, 30);
    
    // Limitar entre 0 e 200
    score = Math.max(0, Math.min(200, score));
    
    // Atualizar no banco
    await db
      .update(userReputation)
      .set({ score, lastUpdated: new Date() })
      .where(eq(userReputation.userId, userId));
    
    return score;
  }
  
  async getUserTier(userId: string): Promise<'novo' | 'normal' | 'verificado'> {
    const score = await this.calculateScore(userId);
    
    if (score < 50) return 'novo';
    if (score >= 150) return 'verificado';
    return 'normal';
  }
  
  async getRateLimitForUser(userId: string): Promise<number> {
    const tier = await this.getUserTier(userId);
    
    const limits = {
      'novo': 3,        // 3 relatos/dia
      'normal': 10,     // 10 relatos/dia
      'verificado': 20  // 20 relatos/dia
    };
    
    return limits[tier];
  }
}

export const reputationSystem = new ReputationSystem();
```

**Integrar no endpoint de criação:**
```typescript
// server/routes.ts - linha 90
app.post(api.reports.create.path, isAuthenticated, createReportLimiter, async (req, res) => {
  try {
    const input = api.reports.create.input.parse(req.body);
    const user = req.user as any;
    const userId = user.claims.sub;
    
    // NOVO: Verificar limite baseado em reputação
    const userLimit = await reputationSystem.getRateLimitForUser(userId);
    const dailyCount = await storage.getUserReportCount(userId, 24);
    
    if (dailyCount >= userLimit) {
      const tier = await reputationSystem.getUserTier(userId);
      return res.status(429).json({
        message: `Limite de ${userLimit} relatórios por dia atingido (nível: ${tier})`,
        field: "rate_limit",
      });
    }
    
    // NOVO: Validar tipo
    if (!ALLOWED_TYPES.includes(input.type)) {
      return res.status(400).json({
        message: "Tipo de relatório inválido",
        field: "type",
      });
    }
    
    // Sanitizar descrição
    const sanitizedDescription = sanitizeDescription(input.description);
    if (sanitizedDescription.length < 10) {
      return res.status(400).json({
        message: "Descrição muito curta. Mínimo 10 caracteres.",
        field: "description",
      });
    }
    
    // NOVO: Validação geográfica
    const isValidLocation = await validateUserLocation(userId, input.lat, input.lng);
    if (!isValidLocation) {
      return res.status(400).json({
        message: "Localização inconsistente com seu último relato",
        field: "location",
      });
    }
    
    // NOVO: Detecção de duplicatas
    const isDuplicate = await detectDuplicate(userId, input, 24);
    if (isDuplicate) {
      return res.status(409).json({
        message: "Você já criou um relato similar nesta área recentemente",
        field: "duplicate",
      });
    }
    
    // Ofuscar localização para privacidade
    const obfuscated = obfuscateLocation(input.lat, input.lng);
    
    const report = await storage.createReport({
      ...input,
      description: sanitizedDescription,
      lat: obfuscated.lat,
      lng: obfuscated.lng,
      userId: userId,
    });
    
    // NOVO: Atualizar reputação
    await reputationSystem.incrementReportsCreated(userId);
    
    // Enviar notificação por email para o administrador (se configurado)
    if (ADMIN_EMAIL) {
      sendNewReportNotification(ADMIN_EMAIL, {
        type: input.type,
        description: sanitizedDescription,
        severity: input.severity || 1,
        lat: obfuscated.lat,
        lng: obfuscated.lng,
      }).catch(err => console.error('Email notification failed:', err));
    }
    
    res.status(201).json({
      ...report,
      userId: undefined,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join('.'),
      });
    }
    throw err;
  }
});
```

---

#### 1.2. Validação Geográfica

```typescript
// server/validation.ts
interface LocationHistory {
  lat: number;
  lng: number;
  timestamp: Date;
}

export async function validateUserLocation(
  userId: string, 
  newLat: number, 
  newLng: number
): Promise<boolean> {
  // Buscar último relato do usuário
  const lastReport = await db
    .select()
    .from(reports)
    .where(eq(reports.userId, userId))
    .orderBy(sql`${reports.createdAt} DESC`)
    .limit(1);
  
  if (!lastReport.length) {
    return true; // Primeiro relato
  }
  
  const last = lastReport[0];
  const timeDiff = Date.now() - last.createdAt.getTime();
  const timeDiffHours = timeDiff / (1000 * 60 * 60);
  
  // Calcular distância em km
  const distance = calculateHaversineDistance(
    last.lat,
    last.lng,
    newLat,
    newLng
  );
  
  // Velocidade máxima razoável: 120 km/h
  const maxDistance = timeDiffHours * 120;
  
  if (distance > maxDistance) {
    console.warn(`Deslocamento impossível detectado para ${userId}: ${distance}km em ${timeDiffHours}h`);
    return false;
  }
  
  return true;
}

function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
```

---

#### 1.3. Detecção de Duplicatas

```typescript
// server/validation.ts
export async function detectDuplicate(
  userId: string,
  newReport: { lat: number; lng: number; description: string; type: string },
  hoursWindow: number = 24
): Promise<boolean> {
  const since = new Date(Date.now() - hoursWindow * 60 * 60 * 1000);
  
  // Buscar relatos próximos do mesmo usuário
  const nearbyReports = await db
    .select()
    .from(reports)
    .where(
      and(
        eq(reports.userId, userId),
        sql`${reports.createdAt} > ${since}`,
        eq(reports.type, newReport.type)
      )
    );
  
  for (const report of nearbyReports) {
    const distance = calculateHaversineDistance(
      report.lat,
      report.lng,
      newReport.lat,
      newReport.lng
    );
    
    // Se estiver a menos de 500m
    if (distance < 0.5) {
      // Calcular similaridade da descrição
      const similarity = calculateStringSimilarity(
        newReport.description,
        report.description
      );
      
      // Se for 85% similar
      if (similarity > 0.85) {
        return true; // É duplicata
      }
    }
  }
  
  return false;
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) {
    return 1.0;
  }
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}
```

---

### **FASE 2 - IMPORTANTE (Implementar em Seguida)**

#### 2.1. Auto-Ocultação de Relatos com Muitos Downvotes

```typescript
// server/storage.ts - Modificar getReports
async getReports(delayMinutes: number = 10): Promise<Report[]> {
  const delayDate = new Date(Date.now() - delayMinutes * 60 * 1000);
  
  // NOVO: Filtrar relatos com muitos downvotes
  return await db
    .select()
    .from(reports)
    .where(
      and(
        lt(reports.createdAt, delayDate),
        // Ocultar se downvotes >= 5 E downvotes > (verifiedCount * 2)
        sql`(${reports.downvoteCount} < 5 OR ${reports.downvoteCount} <= ${reports.verifiedCount} * 2)`
      )
    )
    .orderBy(sql`${reports.createdAt} DESC`);
}
```

---

#### 2.2. Processamento Automático de Denúncias

```typescript
// server/moderation.ts
export class ModerationSystem {
  async processReportFlags(reportId: number): Promise<void> {
    // Contar denúncias aceitas
    const flagCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(reportFlags)
      .where(
        and(
          eq(reportFlags.reportId, reportId),
          eq(reportFlags.status, 'pendente')
        )
      );
    
    const count = Number(flagCount[0]?.count || 0);
    
    // Se 5+ denúncias, ocultar automaticamente
    if (count >= 5) {
      await db
        .update(reports)
        .set({ 
          downvoteCount: sql`${reports.downvoteCount} + 10` // Força ocultação
        })
        .where(eq(reports.id, reportId));
      
      // Marcar denúncias como revisadas
      await db
        .update(reportFlags)
        .set({ status: 'aceito' })
        .where(
          and(
            eq(reportFlags.reportId, reportId),
            eq(reportFlags.status, 'pendente')
          )
        );
      
      // Penalizar criador
      const report = await db
        .select()
        .from(reports)
        .where(eq(reports.id, reportId))
        .limit(1);
      
      if (report.length) {
        await reputationSystem.incrementReportsFlagged(report[0].userId);
      }
    }
  }
}

export const moderationSystem = new ModerationSystem();
```

**Integrar no endpoint de denúncia:**
```typescript
// server/routes.ts - linha 201
app.post(api.flags.create.path, isAuthenticated, async (req, res) => {
  try {
    const reportId = Number(req.params.id);
    const user = req.user as any;
    
    // Verificar se relatório existe
    const report = await storage.getReport(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Relatório não encontrado' });
    }
    
    const input = api.flags.create.input.parse(req.body);
    
    // Validar razão
    if (!ALLOWED_FLAG_REASONS.includes(input.reason)) {
      return res.status(400).json({
        message: "Razão de denúncia inválida",
        field: "reason",
      });
    }
    
    const flag = await storage.createReportFlag({
      ...input,
      reportId,
      userId: user.claims.sub,
      description: input.description ? sanitizeDescription(input.description) : null,
    });
    
    // NOVO: Processar moderação automática
    await moderationSystem.processReportFlags(reportId);
    
    res.status(201).json(flag);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join('.'),
      });
    }
    throw err;
  }
});
```

---

#### 2.3. Verificação de Telefone (SMS)

**Adicionar ao schema:**
```typescript
// shared/models/auth.ts
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  phone: varchar("phone").unique(), // NOVO
  phoneVerified: boolean("phone_verified").default(false), // NOVO
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**Serviço de SMS (usando Twilio):**
```typescript
// server/sms.ts
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function sendVerificationCode(phone: string): Promise<string> {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  await client.messages.create({
    body: `Seu código de verificação Caminho Seguro: ${code}`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phone
  });
  
  // Salvar código temporariamente (usar Redis em produção)
  // Por simplicidade, vou usar memória
  verificationCodes.set(phone, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 min
  });
  
  return code;
}

export async function verifyCode(phone: string, code: string): Promise<boolean> {
  const stored = verificationCodes.get(phone);
  
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    verificationCodes.delete(phone);
    return false;
  }
  
  if (stored.code === code) {
    verificationCodes.delete(phone);
    return true;
  }
  
  return false;
}

// Em produção, use Redis
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();
```

---

### **FASE 3 - AVANÇADA (Futuro)**

#### 3.1. Machine Learning para Detecção de Anomalias

```typescript
// server/ml-detection.ts
export interface ReportFeatures {
  userId: string;
  timeOfDay: number;        // 0-23
  dayOfWeek: number;        // 0-6
  reportType: string;
  severity: number;
  descriptionLength: number;
  userReputationScore: number;
  userAccountAgeDays: number;
  distanceFromLastReport: number;
  reportsInArea: number;    // Relatos próximos nas últimas 24h
}

export class AnomalyDetector {
  async extractFeatures(
    userId: string,
    report: InsertReport
  ): Promise<ReportFeatures> {
    const now = new Date();
    const reputation = await reputationSystem.calculateScore(userId);
    
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    const accountAge = user.length 
      ? Math.floor((Date.now() - user[0].createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    // Distância do último relato
    const lastReport = await db
      .select()
      .from(reports)
      .where(eq(reports.userId, userId))
      .orderBy(sql`${reports.createdAt} DESC`)
      .limit(1);
    
    let distanceFromLast = 0;
    if (lastReport.length) {
      distanceFromLast = calculateHaversineDistance(
        lastReport[0].lat,
        lastReport[0].lng,
        report.lat,
        report.lng
      );
    }
    
    // Relatos na área
    const nearbyReports = await db
      .select({ count: sql<number>`count(*)` })
      .from(reports)
      .where(
        sql`
          ${reports.createdAt} > NOW() - INTERVAL '24 hours'
          AND earth_distance(
            ll_to_earth(${reports.lat}, ${reports.lng}),
            ll_to_earth(${report.lat}, ${report.lng})
          ) < 1000
        `
      );
    
    return {
      userId,
      timeOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      reportType: report.type,
      severity: report.severity || 1,
      descriptionLength: report.description.length,
      userReputationScore: reputation,
      userAccountAgeDays: accountAge,
      distanceFromLastReport: distanceFromLast,
      reportsInArea: Number(nearbyReports[0]?.count || 0),
    };
  }
  
  async calculateAnomalyScore(features: ReportFeatures): Promise<number> {
    let score = 0;
    
    // Usuário novo com muitos relatos
    if (features.userAccountAgeDays < 7 && features.userReputationScore < 50) {
      score += 30;
    }
    
    // Relato em horário suspeito (2h-5h)
    if (features.timeOfDay >= 2 && features.timeOfDay <= 5) {
      score += 10;
    }
    
    // Deslocamento muito grande em curto tempo
    if (features.distanceFromLastReport > 50) {
      score += 20;
    }
    
    // Muitos relatos na área (possível coordenação)
    if (features.reportsInArea > 10) {
      score += 15;
    }
    
    // Descrição muito curta
    if (features.descriptionLength < 20) {
      score += 10;
    }
    
    // Reputação baixa
    if (features.userReputationScore < 30) {
      score += 25;
    }
    
    return Math.min(score, 100);
  }
  
  async shouldFlagForReview(reportId: number): Promise<boolean> {
    const report = await db
      .select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);
    
    if (!report.length) return false;
    
    const features = await this.extractFeatures(report[0].userId, report[0]);
    const anomalyScore = await this.calculateAnomalyScore(features);
    
    // Score > 60 = suspeito
    if (anomalyScore > 60) {
      console.warn(`Relato ${reportId} marcado para revisão (score: ${anomalyScore})`);
      return true;
    }
    
    return false;
  }
}

export const anomalyDetector = new AnomalyDetector();
```

---

## 📊 MELHORIAS NO FRONTEND

### Indicadores Visuais de Confiabilidade

```tsx
// client/src/components/ReportCard.tsx
interface ReportCardProps {
  report: Report & {
    creatorReputation?: number;
  };
}

export function ReportCard({ report }: ReportCardProps) {
  const getTrustBadge = () => {
    if (!report.creatorReputation) return null;
    
    if (report.creatorReputation >= 150) {
      return (
        <Badge className="bg-green-600">
          <ShieldCheck className="w-3 h-3 mr-1" />
          Usuário Verificado
        </Badge>
      );
    }
    
    if (report.creatorReputation < 50) {
      return (
        <Badge variant="outline" className="text-yellow-600">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Usuário Novo
        </Badge>
      );
    }
    
    return null;
  };
  
  const getConfidenceBadge = () => {
    const ratio = report.verifiedCount / Math.max(1, report.downvoteCount);
    
    if (report.verifiedCount >= 3 && ratio >= 2) {
      return (
        <Badge className="bg-blue-600">
          <Users className="w-3 h-3 mr-1" />
          Confirmado por {report.verifiedCount} pessoas
        </Badge>
      );
    }
    
    if (report.downvoteCount >= 3 && ratio < 0.5) {
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Questionado
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline">
        Pendente de validação
      </Badge>
    );
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle>{getReportTitle(report.type)}</CardTitle>
          <div className="flex gap-2">
            {getTrustBadge()}
            {getConfidenceBadge()}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* ... resto do conteúdo */}
      </CardContent>
    </Card>
  );
}
```

---

## 🗂️ ESTRUTURA DE ARQUIVOS SUGERIDA

```
server/
├── routes.ts                    # Rotas principais (existente)
├── storage.ts                   # Camada de dados (existente)
├── validation.ts                # NOVO: Validações geográficas e duplicatas
├── reputation.ts                # NOVO: Sistema de reputação
├── moderation.ts                # NOVO: Moderação automática
├── ml-detection.ts              # NOVO: Detecção de anomalias (Fase 3)
└── sms.ts                       # NOVO: Verificação SMS (Fase 2)

migrations/
├── 0001_add_user_reputation.sql # NOVO
├── 0002_add_phone_verification.sql # NOVO
└── 0003_add_report_status.sql   # NOVO

shared/
└── schema.ts                    # Atualizar com novas tabelas
```

---

## 🚀 CRONOGRAMA DE IMPLEMENTAÇÃO

### **Semana 1**
- [ ] Criar tabela `user_reputation`
- [ ] Implementar `ReputationSystem`
- [ ] Integrar validação de reputação no rate limit

### **Semana 2**
- [ ] Implementar `validateUserLocation()`
- [ ] Implementar `detectDuplicate()`
- [ ] Adicionar validações no endpoint de criação

### **Semana 3**
- [ ] Auto-ocultação com downvotes
- [ ] Sistema de moderação automática
- [ ] Processamento de denúncias

### **Semana 4**
- [ ] Integração Twilio para SMS
- [ ] UI para verificação de telefone
- [ ] Badges visuais no frontend

### **Futuro (Fase 3)**
- [ ] Sistema ML de detecção de anomalias
- [ ] Dashboard administrativo
- [ ] Análise comportamental avançada

---

## 📝 VARIÁVEIS DE AMBIENTE NECESSÁRIAS

```env
# Email
ADMIN_EMAIL=admin@caminhoseguro.ltd

# Twilio (SMS)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+5511999999999

# Redis (para cache de códigos SMS)
REDIS_URL=redis://localhost:6379
```

---

## 🎯 MÉTRICAS DE SUCESSO

Após implementação, monitorar:

1. **Taxa de relatos falsos** (meta: <5%)
2. **Taxa de verificação comunitária** (meta: >60% dos relatos com 3+ verificações)
3. **Tempo médio até primeira verificação** (meta: <2 horas)
4. **Taxa de denúncias processadas** (meta: 100% em <24h)
5. **Score médio de reputação** (meta: >120)

---

## ⚠️ CONSIDERAÇÕES LGPD

✅ **Já implementado:**
- Anonimização de userId nas respostas
- Ofuscação de localização (±50m)

✅ **Manter:**
- Não armazenar telefones sem consentimento
- Dados de reputação devem ser deletáveis
- Logs de validação devem ter retenção de 90 dias

---

## 📞 PRÓXIMOS PASSOS

1. Quer que eu crie os arquivos de código completos para a Fase 1?
2. Prefere começar com qual parte específica?
3. Quer ajuda com a migration SQL da tabela de reputação?

Estou pronto para implementar qualquer uma dessas melhorias! 🚀
