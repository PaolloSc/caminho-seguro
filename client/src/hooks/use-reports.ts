import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { InsertReport, InsertComment } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useReports() {
  return useQuery({
    queryKey: [api.reports.list.path],
    queryFn: async () => {
      const res = await fetch(api.reports.list.path);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return api.reports.list.responses[200].parse(await res.json());
    },
  });
}

export function useReport(id: number | null) {
  return useQuery({
    queryKey: [api.reports.get.path, id],
    queryFn: async () => {
      if (!id) return null;
      const url = buildUrl(api.reports.get.path, { id });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch report");
      return api.reports.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertReport) => {
      // Validate with Zod schema first (optional but good practice)
      const parsed = api.reports.create.input.parse(data);
      
      const res = await fetch(api.reports.create.path, {
        method: api.reports.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Please log in to report.");
        throw new Error("Failed to create report");
      }
      return api.reports.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.reports.list.path] });
      toast({
        title: "Report Added",
        description: "Thank you for helping keep the community safe.",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useVerifyReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.reports.verify.path, { id });
      const res = await fetch(url, {
        method: api.reports.verify.method,
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Please log in to verify reports.");
        throw new Error("Failed to verify report");
      }
      return api.reports.verify.responses[200].parse(await res.json());
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [api.reports.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.reports.get.path, id] });
      toast({
        title: "Verified",
        description: "You've confirmed this report is still relevant.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Comments hooks
export function useComments(reportId: number) {
  return useQuery({
    queryKey: [api.comments.list.path, reportId],
    queryFn: async () => {
      const url = buildUrl(api.comments.list.path, { reportId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch comments");
      return api.comments.list.responses[200].parse(await res.json());
    },
    enabled: !!reportId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertComment) => {
      const parsed = api.comments.create.input.parse(data);
      const res = await fetch(api.comments.create.path, {
        method: api.comments.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Please log in to comment.");
        throw new Error("Failed to post comment");
      }
      return api.comments.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.comments.list.path, variables.reportId] });
      toast({
        title: "Comment Added",
        description: "Your comment has been posted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
