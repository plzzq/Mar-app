import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { BadgeCheck, Building2, IdCard, KeyRound, Bell, Accessibility, Save } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoBadge } from "@/components/common/Widgets";
import { Badge, Button, Card, CardHeader, ErrorState, LoadingState } from "@/components/ui";
import { Input } from "@/components/ui/forms";
import { useToast } from "@/contexts/ToastContext";
import { useQuery } from "@/hooks/useQuery";
import { getErrorMessage } from "@/lib/errors";
import { initials } from "@/lib/utils";
import { getProfile, updateProfile } from "@/services/userService";
import type { UserProfile } from "@/types";

interface ProfileValues {
  name: string;
  role: string;
  email: string;
}

export function ProfilePage() {
  const { data, loading, error, refetch } = useQuery(getProfile);

  const header = (
    <>
      <div className="mb-3">
        <DemoBadge />
      </div>
      <PageHeader
        title="Meu perfil"
        description="Informações da sua conta de demonstração e espaço para preferências futuras."
        breadcrumbs={[{ label: "Visão geral", to: "/" }, { label: "Perfil" }]}
      />
    </>
  );

  if (loading) {
    return (
      <>
        {header}
        <LoadingState label="Carregando perfil…" rows={4} />
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        {header}
        <ErrorState message={error?.message} onRetry={refetch} />
      </>
    );
  }

  return (
    <>
      {header}
      <ProfileContent profile={data} />
    </>
  );
}

function ProfileContent({ profile }: { profile: UserProfile }) {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    defaultValues: { name: profile.name, role: profile.role, email: profile.email },
    mode: "onTouched",
  });

  useEffect(() => {
    reset({ name: profile.name, role: profile.role, email: profile.email });
  }, [profile, reset]);

  const onSubmit = async (values: ProfileValues) => {
    try {
      await updateProfile(values);
      toast({ title: "Perfil atualizado", description: "As alterações foram salvas na demonstração.", variant: "success" });
    } catch (err) {
      toast({ title: "Não foi possível salvar", description: getErrorMessage(err), variant: "error" });
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-1">
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-navy-800 text-2xl font-semibold text-white" aria-hidden="true">
            {initials(profile.name)}
          </span>
          <div>
            <p className="text-lg font-semibold text-navy-900">{profile.name}</p>
            <p className="text-sm text-slate-600">{profile.role}</p>
          </div>
          <Badge tone="info" icon={BadgeCheck}>Perfil de demonstração</Badge>
        </div>
        <dl className="space-y-4 border-t border-slate-100 p-5 text-sm">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <div>
              <dt className="text-xs text-slate-500">Setor</dt>
              <dd className="font-medium text-slate-900">{profile.sector}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <IdCard className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <div>
              <dt className="text-xs text-slate-500">Matrícula</dt>
              <dd className="font-medium text-slate-900">{profile.registration}</dd>
            </div>
          </div>
        </dl>
      </Card>

      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader title="Dados pessoais" description="Estas informações são fictícias nesta versão." />
          <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4 p-5 md:grid-cols-2">
            <Input
              id="profile-name"
              label="Nome completo"
              required
              error={errors.name?.message}
              {...register("name", { required: "Informe o nome completo.", minLength: { value: 3, message: "Informe o nome completo." } })}
            />
            <Input
              id="profile-role"
              label="Função"
              required
              error={errors.role?.message}
              {...register("role", { required: "Informe a função.", minLength: { value: 2, message: "Informe a função." } })}
            />
            <Input
              id="profile-email"
              label="E-mail"
              type="email"
              autoComplete="email"
              required
              wrapperClassName="md:col-span-2"
              error={errors.email?.message}
              {...register("email", {
                required: "Informe o e-mail.",
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Informe um e-mail válido." },
              })}
            />
            <div className="flex justify-end md:col-span-2">
              <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
                <Save className="h-4 w-4" aria-hidden="true" />
                Salvar alterações
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader title="Preferências da conta" description="Estrutura preparada para as configurações definitivas." />
          <ul className="divide-y divide-slate-100 px-5">
            <PlaceholderRow icon={KeyRound} title="Senha e segurança" text="Troca de senha, sessões ativas e autenticação em dois fatores." />
            <PlaceholderRow icon={Bell} title="Notificações pessoais" text="Canais de envio (aplicativo, e-mail) por tipo de alerta." />
            <PlaceholderRow icon={Accessibility} title="Idioma e acessibilidade" text="Idioma da interface, tamanho de texto e leitura em voz alta padrão." />
          </ul>
        </Card>
      </div>
    </div>
  );
}

function PlaceholderRow({ icon: Icon, title, text }: { icon: typeof KeyRound; title: string; text: string }) {
  return (
    <li className="flex items-start justify-between gap-4 py-4">
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-navy-700" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">{text}</p>
        </div>
      </div>
      <Badge tone="neutral">Em breve</Badge>
    </li>
  );
}
