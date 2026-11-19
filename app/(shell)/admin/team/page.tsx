import { InviteForm, RoleSelect } from "@/components/core/team-controls";
import { ActionButton } from "@/components/forms/action-button";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { inviteTeamMemberAction, setTeamRoleAction, setUserActiveAction } from "@/modules/core/actions";
import { listTeam } from "@/modules/core/service";

export const metadata = { title: "Team" };

const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", dateStyle: "medium" });

export default async function TeamPage() {
  const access = await requirePermission("team.view");
  const team = await listTeam(getDb(), access);
  const manage = can(access, "team.manage");

  return (
    <>
      <PageHeader eyebrow="Admin" title="Team" description="Boldly staff with access to Boldly OS. Team members see every client." />
      <div className="space-y-6">
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Name</TH>
                <TH className="hidden md:table-cell">Last sign-in</TH>
                <TH>Role</TH>
                {manage && <TH className="text-right">Access</TH>}
              </TR>
            </THead>
            <TBody>
              {team.map((m) => {
                const self = m.id === access.userId;
                return (
                  <TR key={m.id} className={m.isActive ? undefined : "opacity-60"}>
                    <TD>
                      <p className="font-medium text-brand-ink">
                        {m.name ?? m.email} {self && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{[m.title, m.email].filter(Boolean).join(" · ")}</p>
                    </TD>
                    <TD className="hidden text-muted-foreground md:table-cell">
                      {m.lastSignInAt ? dateFmt.format(m.lastSignInAt) : <Badge variant="muted">Not yet</Badge>}
                    </TD>
                    <TD>
                      {manage && !self && m.role !== "client_user" ? (
                        <RoleSelect role={m.role as "admin" | "team"} action={setTeamRoleAction.bind(null, m.id)} />
                      ) : (
                        <span className="text-sm">{ROLE_LABELS[m.role]}</span>
                      )}
                    </TD>
                    {manage && (
                      <TD className="text-right">
                        {!self && (
                          <ActionButton
                            variant="ghost"
                            size="sm"
                            action={setUserActiveAction.bind(null, m.id, !m.isActive)}
                            confirm={m.isActive ? `Remove ${m.name ?? m.email}'s access?` : undefined}
                          >
                            {m.isActive ? "Deactivate" : "Reactivate"}
                          </ActionButton>
                        )}
                      </TD>
                    )}
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>

        {manage && (
          <Card>
            <CardHeader>
              <CardTitle>Add a team member</CardTitle>
              <CardDescription>They sign in with their Boldly Google account. Anyone on the staff domain is added as a team member automatically on first sign-in.</CardDescription>
            </CardHeader>
            <CardContent>
              <InviteForm action={inviteTeamMemberAction} />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
