import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Receipt, DollarSign, Calculator, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Expenses from "@/pages/expenses";
import Revenue from "@/pages/revenue";
import Tax from "@/pages/tax";

export function HubFinancialView() {
  const [activeTab, setActiveTab] = useState("expenses");
  const { user } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'expenses' || tab === 'revenue' || tab === 'tax') {
      setActiveTab(tab);
    }
  }, []);

  return (
    <>
      {user?.primaryRole === 'property_owner' && (
        <Alert className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            Tax deduction features are designed for investment properties. Please consult a tax professional regarding personal residence expenses.
          </AlertDescription>
        </Alert>
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3 mb-6">
          <TabsTrigger value="expenses">
            <Receipt className="h-4 w-4 mr-2" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="revenue">
            <DollarSign className="h-4 w-4 mr-2" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="tax">
            <Calculator className="h-4 w-4 mr-2" />
            Tax
          </TabsTrigger>
        </TabsList>
        <TabsContent value="expenses" className="mt-0">
          <Expenses />
        </TabsContent>
        <TabsContent value="revenue" className="mt-0">
          <Revenue />
        </TabsContent>
        <TabsContent value="tax" className="mt-0">
          <Tax />
        </TabsContent>
      </Tabs>
    </>
  );
}
