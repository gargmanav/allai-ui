import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calculator, FileText, Users, Download, AlertCircle, TrendingUp, Clock, CheckCircle, XCircle } from "lucide-react";
import PropertyAssistant from "@/components/ai/property-assistant";
import MortgageAdjustmentForm from "@/components/forms/mortgage-adjustment-form";
import ScheduleEReport from "@/components/tax/schedule-e-report";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Property, Transaction, Vendor } from "@shared/schema";

interface VendorReportEntry {
  vendor: Vendor;
  totalPayments: number;
  qualifiesFor1099: boolean;
  w9OnFile: boolean;
}

interface TaxData {
  properties: Property[];
  transactions: Transaction[];
  vendors: Vendor[];
  depreciationAssets: any[];
}

export default function Tax() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("schedule-e");
  const [showMortgageAdjustment, setShowMortgageAdjustment] = useState(false);
  const [selected1099Year, setSelected1099Year] = useState(new Date().getFullYear());

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch all tax-related data
  const { data: properties = [], error: propertiesError } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });
  const { data: transactions = [], error: transactionsError } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });
  const { data: vendors = [], error: vendorsError } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });
  const { data: depreciationAssets = [] } = useQuery<any[]>({
    queryKey: ["/api/depreciation-assets"],
  });

  const { data: vendorReport = [], isLoading: isReportLoading, error: reportError } = useQuery<VendorReportEntry[]>({
    queryKey: ["/api/tax/1099-report", selected1099Year],
    queryFn: async () => {
      const res = await fetch(`/api/tax/1099-report?year=${selected1099Year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch 1099 report");
      return res.json();
    },
  });

  const w9Mutation = useMutation({
    mutationFn: async ({ vendorId, w9OnFile }: { vendorId: string; w9OnFile: boolean }) => {
      await apiRequest("PATCH", `/api/vendors/${vendorId}/w9`, { w9OnFile });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tax/1099-report", selected1099Year] });
      toast({ title: "W-9 status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update W-9 status", variant: "destructive" });
    },
  });

  // Handle query errors
  useEffect(() => {
    const errors = [propertiesError, transactionsError, vendorsError, reportError];
    for (const error of errors) {
      if (error && isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1000);
        return;
      }
    }
  }, [propertiesError, transactionsError, vendorsError, reportError, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Calculate tax metrics
  const expenseTransactions = transactions.filter((t: Transaction) => t.type === "Expense");
  const uncategorizedExpenses = expenseTransactions.filter((t: Transaction) => 
    t.taxDeductible && !t.scheduleECategory
  );
  const vendorsNeed1099 = vendors.filter((v: Vendor) => v.vendorType === "individual" && !v.w9OnFile);
  
  // Calculate total annual expenses by Schedule E category
  const currentYear = new Date().getFullYear();
  const currentYearExpenses = expenseTransactions.filter((t: Transaction) => 
    new Date(t.date).getFullYear() === currentYear
  );
  
  const totalExpenses = currentYearExpenses.reduce((sum: number, t: Transaction) => 
    sum + parseFloat(t.amount), 0
  );

  // Prepare context for Maya AI
  const taxData: TaxData = {
    properties,
    transactions: currentYearExpenses,
    vendors,
    depreciationAssets
  };

  const contextInfo = `Tax Center Analysis - ${currentYear} Tax Year:
- Total Properties: ${properties.length}
- Current Year Expenses: ${currentYearExpenses.length} transactions totaling $${totalExpenses.toLocaleString()}
- Uncategorized Expenses: ${uncategorizedExpenses.length} (${((uncategorizedExpenses.length / Math.max(expenseTransactions.length, 1)) * 100).toFixed(1)}%)
- Schedule E Categories: ${new Set(currentYearExpenses.filter((t: Transaction) => t.scheduleECategory).map((t: Transaction) => t.scheduleECategory)).size} different categories used
- 1099 Vendors: ${vendorsNeed1099.length} vendors need W-9 forms
- Depreciation Assets: ${depreciationAssets.length} assets being tracked
- Tax Readiness: ${uncategorizedExpenses.length === 0 ? 'Ready for Schedule E preparation' : 'Needs expense categorization'}`;

  return (
    <div className="space-y-6" data-testid="page-tax">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tax Center</h1>
          <p className="text-muted-foreground mt-1">
            Schedule E preparation, depreciation tracking, and 1099 reporting
          </p>
        </div>
              <div className="flex gap-2">
                <Button variant="outline" data-testid="button-export-all">
                  <Download className="h-4 w-4 mr-2" />
                  Export All
                </Button>
              </div>
            </div>

            {/* Mortgage Split Tool - Top Priority Banner */}
            {(() => {
              const mortgageExpenses = expenseTransactions.filter((t: Transaction) => 
                t.category === "Mortgage" && new Date(t.date).getFullYear() === currentYear
              );
              
              if (mortgageExpenses.length > 0) {
                return (
                  <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-200 dark:border-blue-800">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                            <Calculator className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <CardTitle className="text-xl text-blue-900 dark:text-blue-100">🏠 Year-End Mortgage Interest Split</CardTitle>
                            <CardDescription className="text-blue-700 dark:text-blue-300 mt-1">
                              Ready for tax season? Split your {mortgageExpenses.length} mortgage payments into deductible interest vs non-deductible principal
                            </CardDescription>
                          </div>
                        </div>
                        <Button 
                          onClick={() => setShowMortgageAdjustment(true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
                          data-testid="button-mortgage-split-top"
                        >
                          Split Mortgage Payments
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                          <FileText className="h-4 w-4" />
                          <span><strong>When:</strong> After receiving Form 1098</span>
                        </div>
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                          <TrendingUp className="h-4 w-4" />
                          <span><strong>Result:</strong> Auto-categorizes interest as deductible</span>
                        </div>
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                          <Clock className="h-4 w-4" />
                          <span><strong>Saves:</strong> Manual categorization for each payment</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              return null;
            })()}

            {/* Tax Metrics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${totalExpenses.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{currentYear} tax year</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Uncategorized</CardTitle>
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{uncategorizedExpenses.length}</div>
                  <p className="text-xs text-muted-foreground">expenses need categories</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">1099 Vendors</CardTitle>
                  <Users className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{vendorsNeed1099.length}</div>
                  <p className="text-xs text-muted-foreground">need W-9 forms</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Assets</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{depreciationAssets.length}</div>
                  <p className="text-xs text-muted-foreground">depreciation assets</p>
                </CardContent>
              </Card>
            </div>

            {/* Maya AI Assistant for Tax Analysis */}
            <PropertyAssistant 
              context={contextInfo}
              exampleQuestions={[
                "What Schedule E categories am I missing?",
                "How much depreciation can I claim this year?", 
                "Which vendors need 1099 forms?",
                "Am I ready for tax season?"
              ]}
            />

            {/* Main Tax Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="schedule-e" data-testid="tab-schedule-e">
                  <FileText className="h-4 w-4 mr-2" />
                  Schedule E
                </TabsTrigger>
                <TabsTrigger value="depreciation" data-testid="tab-depreciation">
                  <Calculator className="h-4 w-4 mr-2" />
                  Depreciation
                </TabsTrigger>
                <TabsTrigger value="1099" data-testid="tab-1099">
                  <Users className="h-4 w-4 mr-2" />
                  1099 Reports
                </TabsTrigger>
                <TabsTrigger value="exports" data-testid="tab-exports">
                  <Download className="h-4 w-4 mr-2" />
                  Exports
                </TabsTrigger>
              </TabsList>

              <TabsContent value="schedule-e" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Schedule E - Rental Income & Expenses</CardTitle>
                    <CardDescription>
                      IRS Schedule E categorization for your rental properties
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {uncategorizedExpenses.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <h3 className="font-semibold text-amber-800">Action Required</h3>
                        </div>
                        <p className="text-amber-700 text-sm mb-3">
                          You have {uncategorizedExpenses.length} uncategorized expenses that need Schedule E categories.
                        </p>
                        <Button 
                          size="sm" 
                          data-testid="button-categorize-expenses"
                          onClick={() => window.location.href = '/expenses?filter=uncategorized'}
                        >
                          Categorize Expenses
                        </Button>
                      </div>
                    )}

                    {/* Mortgage Interest Adjustment */}
                    <Card className="bg-blue-50 dark:bg-blue-950/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Calculator className="h-5 w-5" />
                          Mortgage Interest Adjustment
                        </CardTitle>
                        <CardDescription>
                          Split mortgage payments into deductible interest vs. non-deductible principal using your Form 1098
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Enter your actual interest paid from your mortgage company's year-end statement (Form 1098) 
                            to accurately split mortgage payments for tax reporting.
                          </p>
                          <div className="bg-white dark:bg-gray-900 p-3 rounded border text-xs">
                            <strong>How it works:</strong> Finds all "Mortgage" expenses for the year and splits them 
                            into "Interest" (Schedule E deductible) and "Principal" (non-deductible) based on your actual Form 1098 amounts.
                            Handles partial year ownership automatically.
                          </div>
                          <Button 
                            onClick={() => setShowMortgageAdjustment(true)}
                            className="w-full"
                            data-testid="button-mortgage-adjustment"
                          >
                            Adjust Mortgage Interest
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <ScheduleEReport 
                      properties={properties} 
                      transactions={transactions} 
                      year={currentYear} 
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="depreciation" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Depreciation Assets</CardTitle>
                    <CardDescription>
                      Track building, improvement, and equipment depreciation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Assets ({depreciationAssets.length})</h3>
                      <Button data-testid="button-add-asset">Add Asset</Button>
                    </div>

                    {depreciationAssets.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calculator className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <h3 className="font-semibold mb-2">No Depreciation Assets</h3>
                        <p className="text-sm">
                          Add your buildings, improvements, and equipment to start tracking depreciation.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {depreciationAssets.map((asset: any) => (
                          <div key={asset.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold">{asset.name}</h4>
                                <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                                  <span>Type: <Badge variant="outline">{asset.assetType}</Badge></span>
                                  <span>Cost: ${parseFloat(asset.originalCost).toLocaleString()}</span>
                                  <span>Recovery: {asset.recoveryPeriod} years</span>
                                </div>
                              </div>
                              <Button variant="outline" size="sm">Edit</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="1099" className="space-y-4">
                {(() => {
                  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

                  const vendorsWithPayments = vendorReport.filter(r => r.totalPayments > 0);
                  const vendorsQualifying = vendorReport.filter(r => r.qualifiesFor1099);
                  const vendorsMissingW9 = vendorReport.filter(r => r.qualifiesFor1099 && !r.w9OnFile);

                  const generate1099NEC = (vendor: Vendor, amount: number) => {
                    const payerName = properties.length > 0
                      ? `${properties[0].name || "Property Owner"}`
                      : "Property Owner";
                    const payerAddress = properties.length > 0
                      ? `${properties[0].street}, ${properties[0].city}, ${properties[0].state} ${properties[0].zipCode}`
                      : "Address on file";

                    const html = `<!DOCTYPE html>
<html><head><title>1099-NEC - ${vendor.name} - ${selected1099Year}</title>
<style>
  @media print { body { margin: 0; } .no-print { display: none; } }
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #000; }
  .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
  .header h1 { margin: 0; font-size: 24px; }
  .header h2 { margin: 5px 0; font-size: 16px; color: #555; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 2px solid #000; }
  .form-cell { padding: 12px; border: 1px solid #000; }
  .form-cell label { display: block; font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 4px; }
  .form-cell .value { font-size: 14px; font-weight: bold; }
  .full-width { grid-column: 1 / -1; }
  .amount-box { background: #f9f9f9; }
  .amount-box .value { font-size: 24px; color: #000; }
  .footer { margin-top: 20px; font-size: 11px; color: #666; text-align: center; }
  .print-btn { display: block; margin: 20px auto; padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
  .print-btn:hover { background: #1d4ed8; }
</style></head><body>
<div class="no-print"><button class="print-btn" onclick="window.print()">Print / Save as PDF</button></div>
<div class="header">
  <h2>CORRECTED (if checked) ▢</h2>
  <h1>1099-NEC</h1>
  <h2>Nonemployee Compensation</h2>
  <p style="font-size:12px;">Tax Year ${selected1099Year} | Department of the Treasury - Internal Revenue Service</p>
</div>
<div class="form-grid">
  <div class="form-cell">
    <label>Payer's Name, Street Address, City, State, ZIP</label>
    <div class="value">${payerName}</div>
    <div style="font-size:12px;">${payerAddress}</div>
  </div>
  <div class="form-cell">
    <label>Payer's TIN</label>
    <div class="value">XX-XXXXXXX</div>
  </div>
  <div class="form-cell">
    <label>Recipient's Name</label>
    <div class="value">${vendor.name}</div>
  </div>
  <div class="form-cell">
    <label>Recipient's TIN</label>
    <div class="value">XXX-XX-XXXX</div>
  </div>
  <div class="form-cell">
    <label>Street Address (including apt. no.)</label>
    <div class="value">${vendor.address || "On file"}</div>
  </div>
  <div class="form-cell">
    <label>Account Number (see instructions)</label>
    <div class="value">&nbsp;</div>
  </div>
  <div class="form-cell amount-box">
    <label>1. Nonemployee Compensation</label>
    <div class="value">$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
  </div>
  <div class="form-cell">
    <label>2. Payer made direct sales totaling $5,000 or more ▢</label>
    <div class="value">&nbsp;</div>
  </div>
  <div class="form-cell">
    <label>3. &nbsp;</label>
    <div class="value">&nbsp;</div>
  </div>
  <div class="form-cell">
    <label>4. Federal income tax withheld</label>
    <div class="value">$0.00</div>
  </div>
  <div class="form-cell">
    <label>5. State tax withheld</label>
    <div class="value">$0.00</div>
  </div>
  <div class="form-cell">
    <label>6. State/Payer's state no.</label>
    <div class="value">&nbsp;</div>
  </div>
  <div class="form-cell full-width">
    <label>7. State income</label>
    <div class="value">$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
  </div>
</div>
<div class="footer">
  <p>This is Copy B - For Recipient's Records. This is important tax information and is being furnished to the IRS.</p>
  <p>Generated by AllAI Property Management | For informational purposes - verify with your tax professional</p>
</div>
</body></html>`;
                    const blob = new Blob([html], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    window.open(url, "_blank");
                  };

                  return (
                    <>
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle>1099-NEC Vendor Reports</CardTitle>
                              <CardDescription>
                                Track contractors and service providers for 1099-NEC reporting
                              </CardDescription>
                            </div>
                            <select
                              value={selected1099Year}
                              onChange={(e) => setSelected1099Year(parseInt(e.target.value))}
                              className="border rounded-md px-3 py-2 text-sm bg-background"
                            >
                              {yearOptions.map(y => (
                                <option key={y} value={y}>{y} Tax Year</option>
                              ))}
                            </select>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {isReportLoading ? (
                            <div className="text-center py-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                              <p className="text-muted-foreground text-sm">Loading 1099 report...</p>
                            </div>
                          ) : reportError ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <AlertCircle className="h-12 w-12 mx-auto mb-3 text-red-400 opacity-50" />
                              <h3 className="font-semibold mb-2">Failed to Load Report</h3>
                              <p className="text-sm">Unable to load the 1099 report. Please try again.</p>
                            </div>
                          ) : <>
                          {vendorsMissingW9.length > 0 && (
                            <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                                <h3 className="font-semibold text-amber-800 dark:text-amber-200">W-9 Forms Needed</h3>
                              </div>
                              <p className="text-amber-700 dark:text-amber-300 text-sm">
                                {vendorsMissingW9.length} vendor{vendorsMissingW9.length !== 1 ? "s" : ""} qualifying for 1099 need W-9 forms on file.
                              </p>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card>
                              <CardContent className="pt-4">
                                <div className="text-2xl font-bold">{vendorsWithPayments.length}</div>
                                <p className="text-xs text-muted-foreground">Vendors Paid in {selected1099Year}</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="pt-4">
                                <div className="text-2xl font-bold">{vendorsQualifying.length}</div>
                                <p className="text-xs text-muted-foreground">Qualify for 1099 (≥$600)</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="pt-4">
                                <div className="text-2xl font-bold text-amber-600">{vendorsMissingW9.length}</div>
                                <p className="text-xs text-muted-foreground">Missing W-9 Forms</p>
                              </CardContent>
                            </Card>
                          </div>

                          {vendorsQualifying.length > 0 && (
                            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                              <div>
                                <h3 className="font-semibold text-blue-800 dark:text-blue-200">
                                  {vendorsQualifying.length} vendor{vendorsQualifying.length !== 1 ? "s" : ""} ready for 1099 generation
                                </h3>
                                <p className="text-blue-700 dark:text-blue-300 text-sm">
                                  {vendorsMissingW9.length > 0
                                    ? `${vendorsQualifying.length - vendorsMissingW9.length} have W-9 on file, ${vendorsMissingW9.length} still need W-9`
                                    : "All qualifying vendors have W-9 on file"}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => {
                                  const readyVendors = vendorsQualifying.filter(v => v.w9OnFile);
                                  if (readyVendors.length === 0) {
                                    toast({ title: "No vendors ready", description: "All qualifying vendors are missing W-9 forms.", variant: "destructive" });
                                    return;
                                  }
                                  readyVendors.forEach(({ vendor, totalPayments }) => {
                                    generate1099NEC(vendor, totalPayments);
                                  });
                                  toast({ title: `Generated ${readyVendors.length} 1099-NEC form${readyVendors.length !== 1 ? "s" : ""}` });
                                }}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Generate All 1099s
                              </Button>
                            </div>
                          )}

                          {vendorsWithPayments.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                              <h3 className="font-semibold mb-2">No Vendor Payments</h3>
                              <p className="text-sm">
                                No vendor expense transactions found for {selected1099Year}.
                              </p>
                              <p className="text-sm mt-2">
                                Add vendors in Portfolio &gt; Vendors, then record payments to track 1099 obligations.
                              </p>
                            </div>
                          ) : (
                            <div className="border rounded-lg overflow-hidden">
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b bg-muted/50">
                                      <th className="text-left p-3 font-medium">Vendor</th>
                                      <th className="text-right p-3 font-medium">Total Payments</th>
                                      <th className="text-center p-3 font-medium">W-9 Status</th>
                                      <th className="text-center p-3 font-medium">1099 Required</th>
                                      <th className="text-right p-3 font-medium">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {vendorsWithPayments
                                      .sort((a, b) => b.totalPayments - a.totalPayments)
                                      .map(({ vendor, totalPayments, qualifiesFor1099, w9OnFile }) => (
                                        <tr key={vendor.id} className="border-b last:border-0 hover:bg-muted/30">
                                          <td className="p-3">
                                            <div className="font-medium">{vendor.name}</div>
                                            <div className="text-xs text-muted-foreground">{vendor.vendorType}</div>
                                          </td>
                                          <td className="p-3 text-right font-medium">
                                            ${totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </td>
                                          <td className="p-3 text-center">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => w9Mutation.mutate({ vendorId: vendor.id, w9OnFile: !w9OnFile })}
                                              disabled={w9Mutation.isPending}
                                              className={w9OnFile ? "text-green-600 hover:text-green-700" : "text-red-500 hover:text-red-600"}
                                            >
                                              {w9OnFile ? (
                                                <><CheckCircle className="h-4 w-4 mr-1" /> On File</>
                                              ) : (
                                                <><XCircle className="h-4 w-4 mr-1" /> Missing</>
                                              )}
                                            </Button>
                                          </td>
                                          <td className="p-3 text-center">
                                            {qualifiesFor1099 ? (
                                              <Badge variant="destructive">Required</Badge>
                                            ) : (
                                              <Badge variant="secondary">Under $600</Badge>
                                            )}
                                          </td>
                                          <td className="p-3 text-right">
                                            {qualifiesFor1099 && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => generate1099NEC(vendor, totalPayments)}
                                              >
                                                <FileText className="h-4 w-4 mr-1" />
                                                Generate 1099
                                              </Button>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                          </>}
                        </CardContent>
                      </Card>
                    </>
                  );
                })()}
              </TabsContent>

              <TabsContent value="exports" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Tax Data Exports</CardTitle>
                    <CardDescription>
                      Export tax data for TurboTax, TaxAct, and other tax software
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Schedule E Export</CardTitle>
                          <CardDescription>CSV format compatible with tax software</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Button className="w-full" data-testid="button-export-schedule-e">
                            <Download className="h-4 w-4 mr-2" />
                            Export Schedule E
                          </Button>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">1099 Export</CardTitle>
                          <CardDescription>Vendor payment summaries for 1099 preparation</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Button className="w-full" data-testid="button-export-1099" onClick={() => {
                            const rows = vendorReport
                              .filter(r => r.totalPayments > 0)
                              .map(({ vendor, totalPayments, qualifiesFor1099, w9OnFile }) => [
                                `"${(vendor.name || "").replace(/"/g, '""')}"`,
                                `"${(vendor.address || "").replace(/"/g, '""')}"`,
                                `"${vendor.vendorType || ""}"`,
                                w9OnFile ? "Yes" : "No",
                                totalPayments.toFixed(2),
                                qualifiesFor1099 ? "Yes" : "No",
                              ].join(","));
                            const csv = ["Vendor Name,Vendor Address,Vendor Type,W-9 On File,Total Payments,Qualifies for 1099", ...rows].join("\n");
                            const blob = new Blob([csv], { type: "text/csv" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `1099-data-${selected1099Year}.csv`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast({ title: "1099 data exported" });
                          }}>
                            <Download className="h-4 w-4 mr-2" />
                            Export 1099 Data
                          </Button>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Depreciation Export</CardTitle>
                          <CardDescription>Asset depreciation schedules and calculations</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Button className="w-full" data-testid="button-export-depreciation">
                            <Download className="h-4 w-4 mr-2" />
                            Export Depreciation
                          </Button>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Complete Package</CardTitle>
                          <CardDescription>All tax data in a ZIP file</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Button className="w-full" variant="default" data-testid="button-export-package">
                            <Download className="h-4 w-4 mr-2" />
                            Export Tax Package
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

      {/* Mortgage Adjustment Dialog */}
      <Dialog open={showMortgageAdjustment} onOpenChange={setShowMortgageAdjustment}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mortgage Interest Adjustment</DialogTitle>
          </DialogHeader>
          <MortgageAdjustmentForm 
            properties={properties}
            onClose={() => setShowMortgageAdjustment(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}