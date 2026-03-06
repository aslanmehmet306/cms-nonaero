import { PageHeader } from '@/components/shared/PageHeader';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { BillingPolicyTab } from './BillingPolicyTab';
import { UserManagementTab } from './UserManagementTab';
import { AirportConfigTab } from './AirportConfigTab';

export function Settings() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Settings"
        description="Manage billing policies, users, and airport configuration"
      />

      <Tabs defaultValue="billing-policy">
        <TabsList>
          <TabsTrigger value="billing-policy">Billing Policy</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="airport">Airport</TabsTrigger>
        </TabsList>

        <TabsContent value="billing-policy" className="mt-6">
          <BillingPolicyTab />
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <UserManagementTab />
        </TabsContent>

        <TabsContent value="airport" className="mt-6">
          <AirportConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
