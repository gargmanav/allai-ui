import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, Building2 } from "lucide-react";
import Properties from "@/pages/properties";
import Entities from "@/pages/entities";

export function HubPortfolioView() {
  return (
    <div>
      <Tabs defaultValue="properties" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="properties">
            <Building className="h-4 w-4 mr-2" />
            Properties
          </TabsTrigger>
          <TabsTrigger value="entities">
            <Building2 className="h-4 w-4 mr-2" />
            Entities
          </TabsTrigger>
        </TabsList>
        <TabsContent value="properties" className="mt-0">
          <Properties />
        </TabsContent>
        <TabsContent value="entities" className="mt-0">
          <Entities />
        </TabsContent>
      </Tabs>
    </div>
  );
}
