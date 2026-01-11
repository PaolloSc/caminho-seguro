import { Link } from "wouter";
import { Button } from "@/components/ui/button-custom";
import { ArrowLeft } from "lucide-react";

export default function TermosDeUso() {
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="flex-shrink-0 bg-primary border-b border-primary/20 text-primary-foreground">
        <div className="flex items-center justify-between px-4 h-16">
          <Link href="/configuracoes">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="font-bold text-lg">Termos de Uso</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-10 pb-20">
          <p className="text-sm font-bold text-muted-foreground mb-8 uppercase tracking-widest">Última atualização: Janeiro de 2026</p>

          <div className="prose prose-sm dark:prose-invert max-w-none space-y-10">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Aceitação dos Termos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ao utilizar o CaminhoSeguro, você concorda com estes Termos de Uso. Se você não concorda com qualquer parte destes termos, não utilize o aplicativo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Descrição do Serviço</h2>
            <p className="text-muted-foreground leading-relaxed">
              O CaminhoSeguro é uma plataforma colaborativa que permite às usuárias compartilhar informações sobre segurança em locais públicos. O serviço inclui:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Mapa interativo com relatórios de segurança</li>
              <li>Sistema de verificação comunitária</li>
              <li>Comentários e discussões sobre locais</li>
              <li>Sistema de denúncia de conteúdo inadequado</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Responsabilidades da Usuária</h2>
            <p className="text-muted-foreground leading-relaxed">Ao usar o CaminhoSeguro, você concorda em:</p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Fornecer informações verdadeiras e precisas</li>
              <li>Não publicar conteúdo falso, difamatório ou ofensivo</li>
              <li>Não utilizar o serviço para assediar, perseguir ou prejudicar terceiros</li>
              <li>Respeitar a privacidade de outras usuárias</li>
              <li>Não tentar manipular ou abusar do sistema de verificação</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Conteúdo Gerado pela Usuária</h2>
            <p className="text-muted-foreground leading-relaxed">
              Você é responsável pelo conteúdo que publica. O CaminhoSeguro não garante a precisão das informações compartilhadas por usuárias e não se responsabiliza por danos decorrentes do uso dessas informações.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Reservamo-nos o direito de remover qualquer conteúdo que viole estes termos ou que seja denunciado pela comunidade como falso, ofensivo ou inadequado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Medidas de Segurança</h2>
            <p className="text-muted-foreground leading-relaxed">
              Para proteger a privacidade das usuárias, implementamos as seguintes medidas:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Ofuscação de localização (±50 metros)</li>
              <li>Atraso de 30 minutos na exibição de novos relatos</li>
              <li>Anonimização de identificadores de usuária</li>
              <li>Limite de relatos por hora e por dia</li>
              <li>Sanitização de conteúdo para prevenir ataques</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Limitação de Responsabilidade</h2>
            <p className="text-muted-foreground leading-relaxed">
              O CaminhoSeguro é fornecido "como está", sem garantias de qualquer tipo. Não nos responsabilizamos por:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Precisão ou atualidade das informações fornecidas por usuárias</li>
              <li>Danos resultantes do uso ou incapacidade de uso do serviço</li>
              <li>Decisões tomadas com base nas informações do aplicativo</li>
              <li>Ações de terceiros que violem estes termos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Modificações</h2>
            <p className="text-muted-foreground leading-relaxed">
              Podemos modificar estes Termos de Uso a qualquer momento. Alterações significativas serão comunicadas através do aplicativo. O uso continuado após modificações constitui aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Lei Aplicável</h2>
            <p className="text-muted-foreground leading-relaxed">
              Estes termos são regidos pelas leis da República Federativa do Brasil, incluindo a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018) e o Marco Civil da Internet (Lei 12.965/2014).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Controlador de Dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              O controlador responsável pelo tratamento dos seus dados pessoais é:
            </p>
            <div className="bg-muted/30 p-4 rounded-lg mt-3 space-y-2 text-muted-foreground">
              <p><strong>CaminhoSeguro</strong></p>
              <p>CNPJ: [A ser definido]</p>
              <p>Endereço: São Paulo, SP - Brasil</p>
              <p>DPO: dpo@caminhoseguro.com.br</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Seus Direitos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Conforme a LGPD, você tem direito a:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Confirmar e acessar seus dados</li>
              <li>Corrigir dados incompletos ou desatualizados</li>
              <li>Solicitar anonimização ou exclusão</li>
              <li>Revogar consentimento a qualquer momento</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Para exercer seus direitos, envie email para: privacidade@caminhoseguro.com.br
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contato</h2>
            <p className="text-muted-foreground leading-relaxed">
              Para dúvidas sobre estes Termos de Uso, entre em contato através do email: contato@caminhoseguro.com.br
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-border">
          <Link href="/privacidade">
            <Button variant="ghost" className="p-0 underline" data-testid="link-privacy">
              Ver Política de Privacidade
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
