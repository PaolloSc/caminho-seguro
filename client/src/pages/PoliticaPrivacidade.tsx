import { Link } from "wouter";
import { Button } from "@/components/ui/button-custom";
import { ArrowLeft } from "lucide-react";

export default function PoliticaPrivacidade() {
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="flex-shrink-0 bg-primary border-b border-primary/20 text-primary-foreground">
        <div className="flex items-center justify-between px-4 h-16">
          <Link href="/configuracoes">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="font-bold text-lg">Política de Privacidade</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-10 pb-20">
          <p className="text-sm font-bold text-muted-foreground mb-8 uppercase tracking-widest">Última atualização: Janeiro de 2026</p>

          <div className="prose prose-sm dark:prose-invert max-w-none space-y-10">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introdução</h2>
            <p className="text-muted-foreground leading-relaxed">
              Esta Política de Privacidade descreve como o CaminhoSeguro coleta, usa, armazena e protege suas informações pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Dados Coletados</h2>
            <p className="text-muted-foreground leading-relaxed">Coletamos os seguintes tipos de dados:</p>
            
            <h3 className="text-lg font-medium mt-4 mb-2">2.1 Dados de Identificação</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Identificador único de usuária (anônimo)</li>
              <li>Email (opcional, para autenticação)</li>
              <li>Nome de exibição (opcional)</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">2.2 Dados de Localização</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Coordenadas de relatos (ofuscadas em ±50 metros)</li>
              <li>Localização aproximada para exibição do mapa</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">2.3 Dados de Uso</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Relatos de segurança publicados</li>
              <li>Comentários e verificações</li>
              <li>Denúncias realizadas</li>
              <li>Data e hora das interações</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Base Legal para Tratamento</h2>
            <p className="text-muted-foreground leading-relaxed">
              O tratamento dos seus dados é realizado com base nas seguintes hipóteses legais da LGPD:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li><strong>Consentimento (Art. 7º, I):</strong> Para dados de localização e publicação de relatos</li>
              <li><strong>Legítimo interesse (Art. 7º, IX):</strong> Para segurança da plataforma e prevenção de abusos</li>
              <li><strong>Execução de contrato (Art. 7º, V):</strong> Para fornecer os serviços do aplicativo</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Medidas de Proteção de Dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Implementamos medidas técnicas e organizacionais para proteger sua privacidade:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li><strong>Ofuscação de localização:</strong> Coordenadas são randomizadas em ±50 metros</li>
              <li><strong>Atraso na exibição:</strong> Relatos aparecem após 30 minutos para evitar rastreamento em tempo real</li>
              <li><strong>Anonimização:</strong> Seu identificador não é exibido publicamente</li>
              <li><strong>Criptografia:</strong> Dados transmitidos via HTTPS</li>
              <li><strong>Rate limiting:</strong> Limite de ações para prevenir abusos</li>
              <li><strong>Sanitização:</strong> Todo conteúdo é filtrado para segurança</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Seus Direitos (LGPD)</h2>
            <p className="text-muted-foreground leading-relaxed">
              Conforme a LGPD, você tem os seguintes direitos:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li><strong>Confirmação e acesso:</strong> Saber se tratamos seus dados e acessá-los</li>
              <li><strong>Correção:</strong> Corrigir dados incompletos ou desatualizados</li>
              <li><strong>Anonimização ou eliminação:</strong> Solicitar anonimização ou exclusão de dados desnecessários</li>
              <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
              <li><strong>Revogação do consentimento:</strong> Retirar seu consentimento a qualquer momento</li>
              <li><strong>Oposição:</strong> Opor-se ao tratamento em certas circunstâncias</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Para exercer seus direitos, entre em contato: contato@caminhoseguro.ltd
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Compartilhamento de Dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Seus dados podem ser compartilhados apenas nas seguintes situações:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Por determinação legal ou judicial</li>
              <li>Para proteção da segurança de usuárias</li>
              <li>Com prestadores de serviços essenciais (hospedagem, autenticação)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Não vendemos nem compartilhamos seus dados para fins comerciais ou publicitários.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Retenção de Dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Mantemos seus dados pelo tempo necessário para:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Fornecer os serviços do aplicativo</li>
              <li>Cumprir obrigações legais (mínimo 6 meses conforme Marco Civil)</li>
              <li>Resolver disputas e prevenir fraudes</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Relatos podem expirar automaticamente após 90 dias para manter informações atualizadas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Cookies e Tecnologias</h2>
            <p className="text-muted-foreground leading-relaxed">
              Utilizamos cookies estritamente necessários para:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Manter sua sessão de login</li>
              <li>Lembrar suas preferências</li>
              <li>Garantir a segurança da plataforma</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Alterações nesta Política</h2>
            <p className="text-muted-foreground leading-relaxed">
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre mudanças significativas através do aplicativo. Recomendamos revisar esta página regularmente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Responsável pelo Tratamento de Dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              O responsável pelo tratamento dos seus dados pessoais é:
            </p>
            <div className="bg-muted/30 p-4 rounded-lg mt-3 space-y-2 text-muted-foreground">
              <p><strong>CaminhoSeguro</strong></p>
              <p>Projeto independente de segurança comunitária</p>
              <p>São Paulo, SP - Brasil</p>
              <p>Contato: contato@caminhoseguro.ltd</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Como Exercer Seus Direitos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Para exercer qualquer dos seus direitos previstos na LGPD:
            </p>
            <ol className="list-decimal list-inside text-muted-foreground mt-2 space-y-2">
              <li>Envie um email para: contato@caminhoseguro.ltd</li>
              <li>Informe seu nome completo e email de cadastro</li>
              <li>Descreva qual direito deseja exercer</li>
              <li>Responderemos em até 15 dias úteis</li>
            </ol>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Você também pode registrar reclamação junto à Autoridade Nacional de Proteção de Dados (ANPD) caso considere que seus direitos não foram atendidos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Contato</h2>
            <p className="text-muted-foreground leading-relaxed">
              Para dúvidas sobre privacidade ou qualquer assunto relacionado ao app:
            </p>
            <div className="bg-muted/30 p-4 rounded-lg mt-3 text-muted-foreground">
              <p><strong>Email:</strong> contato@caminhoseguro.ltd</p>
            </div>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-border">
          <Link href="/termos">
            <Button variant="ghost" className="p-0 underline" data-testid="link-terms">
              Ver Termos de Uso
            </Button>
          </Link>
        </div>
      </div>
    </div>
  </div>
);
}
