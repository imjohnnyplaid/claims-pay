import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Building2, Contact, CreditCard, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const bankInfoSchema = z.object({
  bankName: z.string().min(1, "Bank name required"),
  address: z.string().min(1, "Address required"),
  city: z.string().min(1, "City required"),
  state: z.string().length(2, "State must be 2 characters"),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
  bankPhone: z.string().min(10, "Phone number required"),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
});

const contactInfoSchema = z.object({
  contactName: z.string().min(1, "Contact name required"),
  contactTitle: z.string().min(1, "Contact title required"),
  contactEmail: z.string().email("Invalid contact email"),
  contactPhone: z.string().min(10, "Contact phone required"),
});

const paymentSchema = z.object({
  achRoutingNumber: z.string().length(9, "Routing number must be 9 digits"),
  achAccountNumber: z.string().min(4, "Account number required"),
  achAccountType: z.enum(["checking", "savings"]),
});

type BankInfoData = z.infer<typeof bankInfoSchema>;
type ContactInfoData = z.infer<typeof contactInfoSchema>;
type PaymentData = z.infer<typeof paymentSchema>;

export default function BankOnboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [bankData, setBankData] = useState<Partial<BankInfoData & ContactInfoData & PaymentData>>({});

  const bankInfoForm = useForm<BankInfoData>({
    resolver: zodResolver(bankInfoSchema),
    defaultValues: {
      bankName: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      bankPhone: "",
      website: "",
    },
  });

  const contactInfoForm = useForm<ContactInfoData>({
    resolver: zodResolver(contactInfoSchema),
    defaultValues: {
      contactName: "",
      contactTitle: "",
      contactEmail: "",
      contactPhone: "",
    },
  });

  const paymentForm = useForm<PaymentData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      achRoutingNumber: "",
      achAccountNumber: "",
      achAccountType: "checking",
    },
  });

  const createBankMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/banks", data);
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Bank profile created successfully",
      });
      // Use full page redirect to ensure auth data is fresh
      window.location.href = "/bank/dashboard";
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create bank profile",
        variant: "destructive",
      });
    },
  });

  const onStep1Submit = (data: BankInfoData) => {
    setBankData(prev => ({ ...prev, ...data }));
    setStep(2);
  };

  const onStep2Submit = (data: ContactInfoData) => {
    setBankData(prev => ({ ...prev, ...data }));
    setStep(3);
  };

  const onStep3Submit = (data: PaymentData) => {
    const finalData = { ...bankData, ...data };
    createBankMutation.mutate(finalData);
  };

  const progress = (step / 3) * 100;

  const steps = [
    { number: 1, title: "Bank Information", icon: Building2, description: "Basic bank details" },
    { number: 2, title: "Contact Information", icon: Contact, description: "Primary contact details" },
    { number: 3, title: "Payment Setup", icon: CreditCard, description: "ACH account details" },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Bank Partner Onboarding</h1>
          <p className="text-muted-foreground">Set up your banking partner profile</p>
        </div>

        <div className="flex justify-between items-center mb-8">
          {steps.map((s) => (
            <div key={s.number} className="flex items-center gap-2">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  step >= s.number
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background"
                }`}
              >
                {step > s.number ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <s.icon className="h-5 w-5" />
                )}
              </div>
              <div className="hidden sm:block text-sm">
                <div className="font-medium">{s.title}</div>
                <div className="text-muted-foreground text-xs">{s.description}</div>
              </div>
            </div>
          ))}
        </div>

        <Progress value={progress} className="h-2" />

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Bank Information
              </CardTitle>
              <CardDescription>Enter your bank's basic information</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...bankInfoForm}>
                <form onSubmit={bankInfoForm.handleSubmit(onStep1Submit)} className="space-y-4">
                  <FormField
                    control={bankInfoForm.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Name</FormLabel>
                        <FormControl>
                          <Input placeholder="First National Bank" {...field} data-testid="input-bank-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={bankInfoForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main Street" {...field} data-testid="input-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={bankInfoForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="New York" {...field} data-testid="input-city" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bankInfoForm.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input placeholder="NY" maxLength={2} {...field} data-testid="input-state" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={bankInfoForm.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP Code</FormLabel>
                          <FormControl>
                            <Input placeholder="10001" {...field} data-testid="input-zip" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bankInfoForm.control}
                      name="bankPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} data-testid="input-bank-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={bankInfoForm.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://www.yourbank.com" {...field} data-testid="input-website" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" data-testid="button-next">
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Contact className="h-5 w-5" />
                Contact Information
              </CardTitle>
              <CardDescription>Primary contact person for this partnership</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...contactInfoForm}>
                <form onSubmit={contactInfoForm.handleSubmit(onStep2Submit)} className="space-y-4">
                  <FormField
                    control={contactInfoForm.control}
                    name="contactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Smith" {...field} data-testid="input-contact-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={contactInfoForm.control}
                    name="contactTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Title/Role</FormLabel>
                        <FormControl>
                          <Input placeholder="Director of Partnerships" {...field} data-testid="input-contact-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={contactInfoForm.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email (Username)</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@bank.com" {...field} data-testid="input-contact-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={contactInfoForm.control}
                    name="contactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="(555) 123-4567" {...field} data-testid="input-contact-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} data-testid="button-back">
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button type="submit" data-testid="button-next">
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Setup
              </CardTitle>
              <CardDescription>ACH account details for claim funding transfers</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...paymentForm}>
                <form onSubmit={paymentForm.handleSubmit(onStep3Submit)} className="space-y-4">
                  <FormField
                    control={paymentForm.control}
                    name="achRoutingNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ACH Routing Number</FormLabel>
                        <FormControl>
                          <Input placeholder="123456789" maxLength={9} {...field} data-testid="input-routing-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={paymentForm.control}
                    name="achAccountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ACH Account Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Account number" {...field} data-testid="input-account-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={paymentForm.control}
                    name="achAccountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-account-type">
                              <SelectValue placeholder="Select account type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="checking">Checking</SelectItem>
                            <SelectItem value="savings">Savings</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="bg-accent/50 border border-accent rounded-lg p-4 space-y-2">
                    <h4 className="font-medium text-sm">Security Note</h4>
                    <p className="text-sm text-muted-foreground">
                      Your ACH account details are encrypted and stored securely. ClaimPay will use these details to transfer funds when purchasing claims on your behalf.
                    </p>
                  </div>

                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={() => setStep(2)} data-testid="button-back">
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button type="submit" disabled={createBankMutation.isPending} data-testid="button-complete">
                      {createBankMutation.isPending ? "Creating..." : "Complete Setup"}
                      <Check className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
